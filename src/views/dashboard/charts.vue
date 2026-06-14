<template>
  <div class="app-container home">
    <!-- 顶部统计卡片 -->
    <div class="station-top">
      <el-row :gutter="12" class="mt5">
        <el-col :span="6">
          <div class="top-item-box item-box-one">
            <div class="stat-icon">
              <el-icon :size="48"><Box /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">总库存数量</div>
              <div class="stat-value">{{ totalInventory }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="top-item-box item-box-two">
            <div class="stat-icon">
              <el-icon :size="48"><OfficeBuilding /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">仓库总数</div>
              <div class="stat-value">{{ warehouseCount }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="top-item-box item-box-three">
            <div class="stat-icon">
              <el-icon :size="48"><Goods /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">商品种类</div>
              <div class="stat-value">{{ itemCount }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="top-item-box item-box-four">
            <div class="stat-icon">
              <el-icon :size="48"><Warning /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-label">低库存预警</div>
              <div class="stat-value">{{ lowStockCount }}</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 中间图表区域 -->
    <div class="station-middle">
      <el-row :gutter="12">
        <el-col :span="8">
          <el-card class="box-card" shadow="never">
            <div class="card-title">各仓库库存占比</div>
            <div style="height: calc(100% - 30px);">
              <StationPie height="100%" :pieData="warehousePieData"/>
            </div>
          </el-card>
        </el-col>
        <el-col :span="16">
          <el-card class="box-card" shadow="never">
            <div style="display:flex;justify-content: space-between;align-items: center;">
              <div class="card-title">库存Top10商品</div>
              <el-radio-group v-model="topType" @change="handleTopTypeChange">
                <el-radio-button label="quantity">按数量</el-radio-button>
                <el-radio-button label="sku">按SKU</el-radio-button>
              </el-radio-group>
            </div>
            <div style="height: calc(100% - 30px);">
              <StationBar height="100%" :chartData="topBarChartData" :xName="topXName"/>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 底部图表区域 -->
    <div class="station-bottom">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-card class="box-card" shadow="never">
            <div class="card-title">库位统计表</div>
            <div style="height: calc(100% - 30px);">
              <StationBar height="100%" :chartData="locationBarData" :series-data="locationSeriesData" xName="个"/>
            </div>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card class="box-card" shadow="never">
            <div class="card-title">库存变化趋势（近30天）</div>
            <div style="height: calc(100% - 30px);">
              <StationLine height="100%" yName="件" :chartData="trendLineData" :series-data="trendLineData.series"/>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import StationPie from './components/StationPie.vue'
import StationLine from './components/StationLine.vue'
import StationBar from './components/StationBar.vue'
import { onMounted, ref } from 'vue'
import { listInventoryBoard } from '@/api/wms/inventory'
import { listInventoryHistory } from '@/api/wms/inventoryHistory'
import { listLocation } from '@/api/wms/location'
import { useWmsStore } from '@/store/modules/wms'
import moment from 'moment'

const wmsStore = useWmsStore()

// 顶部统计数据
const totalInventory = ref(0)
const warehouseCount = ref(0)
const itemCount = ref(0)
const lowStockCount = ref(0)

// 饼图数据
const warehousePieData = ref([])

// Top10柱状图
const topType = ref('quantity')
const topBarChartData = ref({
  xData: [],
  yData: []
})
const topXName = ref('件')

// 库位柱状图
const locationBarData = ref({
  xData: [],
  yData: []
})
const locationSeriesData = ref([])

// 趋势折线图
const trendLineData = ref({
  xData: [],
  series: [] // 改为 series 数组
})

onMounted(() => {
  loadInventoryData()
  loadLocationData()
})

// 加载库存数据
async function loadInventoryData() {
  try {
    const warehouseRes = await listInventoryBoard({}, 'warehouse')
    const warehouseData = warehouseRes.rows || []

    const itemRes = await listInventoryBoard({}, 'item')
    const itemData = itemRes.rows || []

    calculateTopStats(warehouseData, itemData)

    calculateWarehousePie(warehouseData)

    calculateTop10Bar(itemData)

    await loadWarehouseTrendData()

  } catch (error) {
    console.error('加载库存数据失败:', error)
  }
}

// 计算顶部统计
function calculateTopStats(warehouseData, itemData) {
  // 总库存数量
  totalInventory.value = warehouseData.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  // 仓库数量
  const warehouses = new Set(warehouseData.map(item => item.warehouseId))
  warehouseCount.value = warehouses.size

  // 商品种类
  const items = new Set(itemData.map(item => item.item.id))
  itemCount.value = items.size

  // 低库存预警（库存小于10的商品）
  lowStockCount.value = itemData.filter(item => Number(item.quantity) < 10).length
}

// 计算仓库饼图
function calculateWarehousePie(warehouseData) {
  const warehouseMap = {}
  warehouseData.forEach(item => {
    const warehouseName = wmsStore.warehouseMap.get(item.warehouseId)?.warehouseName || '未知仓库'
    if (!warehouseMap[warehouseName]) {
      warehouseMap[warehouseName] = 0
    }
    warehouseMap[warehouseName] += Number(item.quantity || 0)
  })

  warehousePieData.value = Object.entries(warehouseMap).map(([name, value]) => ({
    name,
    value
  }))
}

// 计算Top10柱状图
function calculateTop10Bar(itemData) {
  console.log('商品维度原始数据:', itemData)

  if (topType.value === 'quantity') {
    // 按数量统计
    const itemMap = {}
    itemData.forEach(item => {
      const itemName = item.item?.itemName || '未知商品'
      const quantity = Number(item.quantity || 0)

      console.log(`商品: ${itemName}, 数量: ${quantity}`)

      if (!itemMap[itemName]) {
        itemMap[itemName] = 0
      }
      itemMap[itemName] += quantity
    })

    console.log('按数量统计结果:', itemMap)

    const sorted = Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    console.log('Top10排序结果:', sorted)

    topBarChartData.value = {
      xData: sorted.map(item => item[0]),
      yData: sorted.map(item => item[1])
    }
    topXName.value = '件'
  } else {
    // 按SKU数量统计
    const itemMap = {}
    itemData.forEach(item => {
      const itemName = item.item?.itemName || '未知商品'
      if (!itemMap[itemName]) {
        itemMap[itemName] = new Set()
      }
      itemMap[itemName].add(item.skuId)
    })

    const sorted = Object.entries(itemMap)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)

    topBarChartData.value = {
      xData: sorted.map(item => item[0]),
      yData: sorted.map(item => item[1].size)
    }
    topXName.value = '个'
  }

  console.log('最终图表数据:', topBarChartData.value)
}

// 计算库位柱状图
async function loadLocationData() {
  try {
    const res = await listLocation({ pageNum: 1, pageSize: 1000 })
    const locationList = res.rows || []

    const warehouseMap = {}

    locationList.forEach(location => {
      const warehouseName = wmsStore.warehouseMap.get(location.warehouseId)?.warehouseName || '未知仓库'

      if (!warehouseMap[warehouseName]) {
        warehouseMap[warehouseName] = {
          total: 0,
          inUse: 0,
          free: 0
        }
      }

      warehouseMap[warehouseName].total++

      if (location.status === '2' || location.status === 2) {
        warehouseMap[warehouseName].inUse++
      } else if (location.status === '1' || location.status === 1) {
        warehouseMap[warehouseName].free++
      }
    })

    const warehouses = Object.keys(warehouseMap)
    const totalData = warehouses.map(name => warehouseMap[name].total)
    const inUseData = warehouses.map(name => warehouseMap[name].inUse)
    const freeData = warehouses.map(name => warehouseMap[name].free)

    locationBarData.value = {
      xData: warehouses,
      series: [
        {
          name: '总库位数',
          data: totalData,
          type: 'bar',
          itemStyle: { color: '#5470c6' }
        },
        {
          name: '使用中',
          data: inUseData,
          type: 'bar',
          itemStyle: { color: '#fac858' }
        },
        {
          name: '空闲',
          data: freeData,
          type: 'bar',
          itemStyle: { color: '#91cc75' }
        }
      ]
    }

    locationSeriesData.value = locationBarData.value.series
  } catch (error) {
    console.error('加载库位数据失败:', error)
    locationBarData.value = {
      xData: [],
      series: []
    }
    locationSeriesData.value = []
  }
}

// ... existing code ...
// 加载各仓库最近一个月的库存变化趋势
async function loadWarehouseTrendData() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30) // 最近30天

  const params = {
    pageNum: 1,
    pageSize: 5000,
    createTimeRange: [
      moment(startDate).format('YYYY-MM-DD') + ' 00:00:00',
      moment(endDate).format('YYYY-MM-DD') + ' 23:59:59'
    ]
  }

  try {
    const res = await listInventoryHistory(params)
    const historyData = res.rows || []

    // 1. 收集所有仓库ID和日期（使用完整日期格式 YYYY-MM-DD）
    const warehouseIds = new Set()
    const dateMap = {} // 用对象存储，key为YYYY-MM-DD，value为MM-DD

    historyData.forEach(item => {
      if (item.warehouseId && item.createTime) {
        warehouseIds.add(item.warehouseId)
        const fullDate = moment(item.createTime).format('YYYY-MM-DD')
        const shortDate = moment(item.createTime).format('MM-DD')
        dateMap[fullDate] = shortDate
      }
    })

    // 2. 排序完整日期，然后转换为短日期
    const sortedDates = Object.keys(dateMap)
      .sort((a, b) => new Date(a) - new Date(b))
      .map(fullDate => dateMap[fullDate])

    // 3. 按仓库和日期分组统计 afterQuantity
    const warehouseDailyMap = {}
    warehouseIds.forEach(warehouseId => {
      warehouseDailyMap[warehouseId] = {}
      sortedDates.forEach(shortDate => {
        warehouseDailyMap[warehouseId][shortDate] = 0
      })
    })

    historyData.forEach(item => {
      if (item.warehouseId && item.createTime && item.afterQuantity !== undefined) {
        const shortDate = moment(item.createTime).format('MM-DD')
        if (warehouseDailyMap[item.warehouseId] && warehouseDailyMap[item.warehouseId].hasOwnProperty(shortDate)) {
          warehouseDailyMap[item.warehouseId][shortDate] += Number(item.afterQuantity) || 0
        }
      }
    })

    // 4. 构建图表数据
    const series = []
    warehouseIds.forEach(warehouseId => {
      const warehouseName = wmsStore.warehouseMap.get(warehouseId)?.warehouseName || '未知仓库'
      const data = sortedDates.map(date => warehouseDailyMap[warehouseId][date])

      series.push({
        name: warehouseName,
        data: data,
        type: 'line',
        smooth: true
      })
    })

    trendLineData.value = {
      xData: sortedDates,
      series: series
    }
  } catch (error) {
    console.error('加载仓库趋势数据失败:', error)
    trendLineData.value = {
      xData: [],
      series: []
    }
  }
}


// 切换Top类型
function handleTopTypeChange() {
  listInventoryBoard({}, 'item').then(res => {
    calculateTop10Bar(res.rows || [])
  })
}
</script>

<style scoped>
.app-container {
  min-height: calc(100vh - 84px);
  padding: 12px 12px 0 12px;
}

.top-item-box {
  height: 120px;
  background: #fff;
  margin-bottom: 12px;
  border-radius: 12px;
  color: #fff;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-icon {
  flex: 0 0 auto;
  opacity: 0.9;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  line-height: 1;
}

.item-box-one {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.item-box-two {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
}

.item-box-three {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
}

.item-box-four {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  box-shadow: 0 4px 12px rgba(250, 112, 154, 0.3);
}

.box-card {
  height: 400px;
  margin-bottom: 12px;
  background-color: #fff;
  border-color: #ebe6f5;
}

.box-card >>> .el-card__body {
  height: 100%;
}

.card-title {
  font-weight: bold;
  height: 30px;
  display: flex;
  align-items: center;
}

.card-title::before {
  content: '';
  height: 70%;
  width: 5px;
  background: #3671e8;
  margin-right: 8px;
}
</style>
