// @generated-stub — missing from sourcemap, see scripts/gen-stubs.ts
// Type definitions inferred from codebase usage patterns

export type NotebookCellType = 'code' | 'markdown'

export type NotebookCellOutput =
  | { output_type: 'stream'; name?: string; text: string | string[] }
  | { output_type: 'display_data' | 'execute_result'; data?: Record<string, unknown>; metadata?: Record<string, unknown> }
  | { output_type: 'error'; ename: string; evalue: string; traceback: string[] }

export type NotebookOutputImage = { image_data: string; media_type: 'image/png' | 'image/jpeg' }

export type NotebookCellSourceOutput = { output_type: string; text?: string; image?: NotebookOutputImage }

export type NotebookCellSource = {
  cellType: NotebookCellType; source: string; execution_count?: number
  cell_id: string; language?: string; outputs?: NotebookCellSourceOutput[]
}

export type NotebookCell = {
  id?: string; cell_type: NotebookCellType; source: string | string[]
  execution_count?: number | null; outputs?: NotebookCellOutput[]; metadata?: Record<string, unknown>
}

export type NotebookContent = {
  cells: NotebookCell[]
  metadata: { language_info?: { name: string }; [key: string]: unknown }
  nbformat: number; nbformat_minor: number
}
