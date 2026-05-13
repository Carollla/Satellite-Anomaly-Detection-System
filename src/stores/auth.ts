import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export interface RegisteredUser {
  username: string
  password: string
  role: 'operator' | 'viewer'
  createdAt: string
}

export interface User {
  username: string
  role: 'admin' | 'operator' | 'viewer'
  token?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)

  function getRegisteredUsers(): RegisteredUser[] {
    try {
      const usersJson = localStorage.getItem('satops_registered_users')
      return usersJson ? JSON.parse(usersJson) : []
    } catch {
      return []
    }
  }

  function saveRegisteredUsers(users: RegisteredUser[]) {
    localStorage.setItem('satops_registered_users', JSON.stringify(users))
  }

  function loadAuth() {
    const savedUser = localStorage.getItem('satops_user')
    const savedToken = localStorage.getItem('satops_token')

    if (savedUser && savedToken) {
      user.value = JSON.parse(savedUser)
      isAuthenticated.value = true
    }
  }

  async function register(username: string, password: string, confirmPassword: string): Promise<boolean> {
    if (!username || !password || !confirmPassword) {
      ElMessage.error('请填写完整信息')
      return false
    }

    if (username.trim().toLowerCase() === 'admin') {
      ElMessage.error('不能注册管理员账号')
      return false
    }

    if (password.length < 3) {
      ElMessage.error('密码长度至少 3 位')
      return false
    }

    if (password !== confirmPassword) {
      ElMessage.error('两次输入的密码不一致')
      return false
    }

    const registeredUsers = getRegisteredUsers()
    if (registeredUsers.some((item) => item.username.toLowerCase() === username.trim().toLowerCase())) {
      ElMessage.error('用户名已存在')
      return false
    }

    registeredUsers.push({
      username: username.trim(),
      password,
      role: 'viewer',
      createdAt: new Date().toISOString()
    })
    saveRegisteredUsers(registeredUsers)
    ElMessage.success('注册成功，请登录')
    return true
  }

  async function login(username: string, password: string): Promise<boolean> {
    if (!username || !password) {
      ElMessage.error('用户名和密码不能为空')
      return false
    }

    const usernameLower = username.toLowerCase().trim()
    let role: User['role'] = 'viewer'
    let isValid = false

    if (usernameLower === 'admin' && password === 'admin') {
      role = 'admin'
      isValid = true
    } else {
      const foundUser = getRegisteredUsers().find(
        (item) => item.username.toLowerCase() === usernameLower && item.password === password
      )
      if (foundUser) {
        role = foundUser.role
        isValid = true
      }
    }

    if (!isValid) {
      ElMessage.error('用户名或密码错误')
      return false
    }

    const token = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`
    user.value = { username: username.trim(), role, token }
    isAuthenticated.value = true
    localStorage.setItem('satops_user', JSON.stringify(user.value))
    localStorage.setItem('satops_token', token)
    ElMessage.success('登录成功')
    return true
  }

  function logout() {
    user.value = null
    isAuthenticated.value = false
    localStorage.removeItem('satops_user')
    localStorage.removeItem('satops_token')
    ElMessage.success('已退出登录')
  }

  loadAuth()

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    loadAuth,
    getRegisteredUsers,
    saveRegisteredUsers
  }
})
