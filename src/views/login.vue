<template>
  <div class="login">
    <div class="login-container">
      <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
        <div class="form-header">
          <h4 class="title">Hi, 欢迎登录</h4>
        </div>

        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            type="text"
            size="large"
            auto-complete="off"
            placeholder="请输入账号"
            prefix-icon="User"
          >
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            size="large"
            auto-complete="off"
            placeholder="请输入密码"
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          >
          </el-input>
        </el-form-item>

        <el-form-item prop="code" v-if="captchaEnabled">
          <div class="captcha-wrapper">
            <el-input
              v-model="loginForm.code"
              size="large"
              auto-complete="off"
              placeholder="验证码"
              prefix-icon="Key"
              style="flex: 1"
              @keyup.enter="handleLogin"
            >
            </el-input>
            <div class="captcha-img-wrapper" @click="getCode">
              <img :src="codeUrl" alt="验证码"/>
            </div>
          </div>
        </el-form-item>

        <div class="form-options">
          <el-checkbox v-model="loginForm.rememberMe" size="large">记住密码</el-checkbox>
<!--          <span class="forgot-link">忘记密码?</span>-->
        </div>

        <el-form-item>
          <el-button
            :loading="loading"
            size="large"
            type="primary"
            class="login-btn"
            @click.prevent="handleLogin"
          >
            <span v-if="!loading">立即登录</span>
            <span v-else>登录中...</span>
          </el-button>
        </el-form-item>
      </el-form>

      <div class="footer-info">
        <p>© 2026 Nova-WMS 智能仓储管理系统</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getCodeImg } from "@/api/login";
import Cookies from "js-cookie";
import { encrypt, decrypt } from "@/utils/jsencrypt";
import useUserStore from '@/store/modules/user'

const userStore = useUserStore()
const router = useRouter();
const route = useRoute();
const { proxy } = getCurrentInstance();

const loginForm = ref({
  username: "",
  password: "",
  rememberMe: false,
  code: "",
  uuid: ""
});

const loginRules = {
  username: [{ required: true, trigger: "blur", message: "请输入您的账号" }],
  password: [{ required: true, trigger: "blur", message: "请输入您的密码" }],
  code: [{ required: true, trigger: "change", message: "请输入验证码" }]
};

const codeUrl = ref("");
const loading = ref(false);
// 验证码开关
const captchaEnabled = ref(true);
// 注册开关
const register = ref(false);
const redirect = ref(undefined);
const dialogVisible = ref(false);

watch(route, (newRoute) => {
  redirect.value = newRoute.query && newRoute.query.redirect;
}, { immediate: true });

function handleTry(){
  dialogVisible.value =true
}
function dialogConfirm(){
  dialogVisible.value =false;
}

function handleLogin() {
  proxy.$refs.loginRef.validate(valid => {
    if (valid) {
      loading.value = true;
      // 勾选了需要记住密码设置在 cookie 中设置记住用户名和密码
      if (loginForm.value.rememberMe) {
        Cookies.set("username", loginForm.value.username, { expires: 30 });
        Cookies.set("password", encrypt(loginForm.value.password), { expires: 30 });
        Cookies.set("rememberMe", loginForm.value.rememberMe, { expires: 30 });
      } else {
        // 否则移除
        Cookies.remove("username");
        Cookies.remove("password");
        Cookies.remove("rememberMe");
      }
      // 调用action的登录方法
      userStore.login(loginForm.value).then(() => {
        router.push({ path: redirect.value || "/index" });
      }).catch(() => {
        loading.value = false;
        // 重新获取验证码
        if (captchaEnabled.value) {
          getCode();
        }
      });
    }
  });
}

function getCode() {
  getCodeImg().then(res => {
    captchaEnabled.value = res.data.captchaEnabled === undefined ? true : res.data.captchaEnabled;
    if (captchaEnabled.value) {
      codeUrl.value = "data:image/gif;base64," + res.data.img;
      loginForm.value.uuid = res.data.uuid;
    }
  });
}

function getCookie() {
  const username = Cookies.get("username");
  const password = Cookies.get("password");
  const rememberMe = Cookies.get("rememberMe");
  loginForm.value = {
    username: username === undefined ? loginForm.value.username : username,
    password: password === undefined ? loginForm.value.password : decrypt(password),
    rememberMe: rememberMe === undefined ? false : Boolean(rememberMe)
  };
}

getCode();
getCookie();
</script>

<style lang='scss' scoped>
.login {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-image: url("../assets/images/login-background.jpg");
  background-size: cover;
  background-position: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.3) 0%, rgba(30, 58, 138, 0.25) 100%);
  }
}

.login-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 480px;
  padding: 0 20px;
  animation: fadeInUp 0.6s ease-out;
}

.form-header {
  text-align: center;
  margin-bottom: 15px;

  .title {
    font-size: 28px;
    font-weight: 400;
    color: #999999;
    margin: 0 0 8px 0;
    letter-spacing: 3px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

}

.login-form {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 20px;
  padding: 15px 40px 25px 40px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25),
  0 0 0 1px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(20px);

  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-input__wrapper) {
    border-radius: 12px;
    padding: 11px 15px;
    background-color: #f8fafc;
    border: 2px solid transparent;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background-color: #ffffff;
      border-color: #cbd5e1;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    &.is-focus {
      background-color: #ffffff;
      border-color: #3b82f6;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
    }
  }

  :deep(.el-input__inner) {
    font-size: 18px;
    color: #1e293b;

    &::placeholder {
      color: #94a3b8;
    }
  }

  :deep(.el-input__prefix) {
    color: #64748b;
    font-size: 18px;
    margin-right: 8px;
  }
}

.captcha-wrapper {
  display: flex;
  gap: 12px;
  align-items: center;

  .captcha-img-wrapper {
    width: 135px;
    height: 52px;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid #e2e8f0;
    transition: all 0.3s ease;
    background: #f8fafc;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &:hover {
      border-color: #3b82f6;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
      transform: scale(1.02);
    }
  }
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;

  :deep(.el-checkbox__label) {
    font-size: 14px;
    color: #475569;
  }

  :deep(.el-checkbox__inner) {
    border-radius: 6px;
    border-color: #cbd5e1;

    &:hover {
      border-color: #3b82f6;
    }
  }

  :deep(.el-checkbox.is-checked .el-checkbox__inner) {
    background-color: #3b82f6;
    border-color: #3b82f6;
  }

  .forgot-link {
    font-size: 14px;
    color: #3b82f6;
    cursor: pointer;
    transition: color 0.3s ease;

    &:hover {
      color: #2563eb;
      text-decoration: underline;
    }
  }
}

.login-btn {
  width: 100%;
  height: 50px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.35);

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(59, 130, 246, 0.45);
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.footer-info {
  text-align: center;
  margin-top: 20px;

  p {
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    margin: 0;
    letter-spacing: 1px;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .login-container {
    max-width: 100%;
    padding: 0 15px;
  }

  .login-form {
    padding: 30px 25px 25px 25px;
    border-radius: 16px;
  }

  .form-header {
    .title {
      font-size: 24px;
    }

  }

  .captcha-wrapper {
    .captcha-img-wrapper {
      width: 100px;
      height: 48px;
    }
  }

  .login-btn {
    height: 48px;
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .login-form {
    padding: 25px 20px 20px 20px;
  }

  .form-header {
    margin-bottom: 15px;

    .title {
      font-size: 22px;
      letter-spacing: 2px;
    }
  }

  .form-options {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>
