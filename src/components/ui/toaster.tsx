"use client"

import React, { useState, useEffect } from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm">
      {toasts
        .filter(toast => toast.open)
        .map(({ id, title, description, action, onOpenChange, ...props }) => (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action && <div>{action}</div>}
            <ToastClose onClick={() => onOpenChange?.(false)} />
          </Toast>
        ))}
    </div>
  )
} 