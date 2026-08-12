import { api } from "./api"

export const exportService = {
    exportTestRunResults: async (runId: string) => {
        const response = await api.get(`/runs/${runId}/export-results`, {
            responseType: 'blob',
        })
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `test-run-${runId}-results.xlsx`)
        document.body.appendChild(link)
        link.click()
        link.remove()
    },

    exportComparisonReport: async (runId: string) => {
        const response = await api.get(`/runs/${runId}/export-comparison`, {
            responseType: 'blob',
        })
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `test-run-${runId}-comparison.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
    },

    exportTestCases: async (projectId: string) => {
        const response = await api.get(`/projects/${projectId}/export-cases`, {
            responseType: 'blob',
        })
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `project-${projectId}-test-cases.xlsx`)
        document.body.appendChild(link)
        link.click()
        link.remove()
    }
}
