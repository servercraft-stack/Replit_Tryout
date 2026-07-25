import client from './client'

export interface ExecutionResult {
  output: string
  error: string
  exit_code: number
  language: string
  timed_out: boolean
}

export async function executeCode(language: string, code: string, stdin = '') {
  const { data } = await client.post('/colab/execute/', { language, code, stdin })
  return data as ExecutionResult
}

export async function getAvailableLanguages() {
  const { data } = await client.get('/colab/languages/')
  return data as { languages: string[] }
}
