import router from './router'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { getToken } from '@/utils/auth'
import { isHttp } from '@/utils/validate'
import { isRelogin } from '@/utils/request'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'
import {useWmsStore} from '@/store/modules/wms';
import { getConfigKey } from '@/api/system/config'

NProgress.configure({ showSpinner: false });

const whiteList = ['/login', '/register'];

router.beforeEach((to, from, next) => {
  NProgress.start()
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title)
    /* has token*/
    if (to.path === '/login') {
      next({ path: '/index' })
      NProgress.done()
    } else {
      if (useUserStore().roles.length === 0) {
        isRelogin.show = true
        // 判断当前用户是否已拉取完user_info信息
        useUserStore().getInfo().then(() => {
          isRelogin.show = false
          usePermissionStore().generateRoutes().then(accessRoutes => {
            // 根据roles权限生成可访问的路由表
            accessRoutes.forEach(route => {
              if (!isHttp(route.path)) {
                router.addRoute(route) // 动态添加可访问路由表
              }
            })
            next({ ...to, replace: true }) // hack方法 确保addRoutes已完成
          })
        }).catch(err => {
          useUserStore().logOut().then(() => {
            ElMessage.error(err)
            next({ path: '/' })
          })
        })
        initData()
      } else {
        next()
      }
    }
  } else {
    // 没有token
    if (whiteList.indexOf(to.path) !== -1) {
      // 在免登录白名单，直接进入
      next()
    } else {
      next(`/login?redirect=${to.fullPath}`) // 否则全部重定向到登录页
      NProgress.done()
    }
  }
})

async function initData() {
  // 从后端加载系统主题配置（不阻塞登录，后台执行）
  loadSystemTheme()
  
  await useWmsStore().getWarehouseList()
  await useWmsStore().getMerchantList()
  await useWmsStore().getItemCategoryList()
  await useWmsStore().getItemCategoryTreeList()
  await useWmsStore().getItemBrandList()
}

/** 从后端加载系统主题配置并应用到前端 */
function loadSystemTheme() {
  const settingsStore = useSettingsStore()
  // 使用 Promise.allSettled 确保即使某个请求失败也不会阻塞
  Promise.allSettled([
    getConfigKey('sys.index.sideTheme'),
    getConfigKey('sys.index.skinName')
  ]).then(([sideThemeResult, skinResult]) => {
    // 应用侧边栏主题
    if (sideThemeResult.status === 'fulfilled') {
      const sideTheme = sideThemeResult.value?.msg || sideThemeResult.value?.data
      if (sideTheme && (sideTheme === 'theme-dark' || sideTheme === 'theme-light')) {
        settingsStore.changeSetting({ key: 'sideTheme', value: sideTheme })
      }
    }
    
    // 应用皮肤颜色
    if (skinResult.status === 'fulfilled') {
      const skinName = skinResult.value?.msg || skinResult.value?.data
      if (skinName && typeof skinName === 'string') {
        const colorMap = {
          'skin-blue': '#409EFF',
          'skin-green': '#67C23A',
          'skin-yellow': '#E6A23C',
          'skin-red': '#F56C6C',
          'skin-purple': '#909399'
        }
        const themeColor = colorMap[skinName]
        if (themeColor) {
          settingsStore.changeSetting({ key: 'theme', value: themeColor })
        }
      }
    }
  }).catch(e => {
    console.warn('[主题] 加载系统主题配置失败:', e.message)
  })
}

router.afterEach(() => {
  NProgress.done()
})
