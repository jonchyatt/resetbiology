import base from './playwright-test.config'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  ...base,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4315',
    launchOptions: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  },
})
