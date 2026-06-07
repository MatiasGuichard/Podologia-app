import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ open, title, description, confirmLabel = "Eliminar", onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onCancel() }}>
      <DialogContent>
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        <div className="flex gap-3 justify-center mt-4">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmDialog
