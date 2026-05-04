import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sidebarVariants = cva("relative flex h-full min-h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground", {
  variants: {
    variant: {
      default: "bg-sidebar text-sidebar-foreground",
      destructive: "bg-destructive text-destructive-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

const Sidebar = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(sidebarVariants({ variant }), className)}
    {...props}
  />
))
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-16 items-center border-b px-6", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-auto py-2", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

const SidebarFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-auto border-t p-4", className)}
    {...props}
  />
))
SidebarFooter.displayName = "SidebarFooter"

const SidebarMenu = React.forwardRef(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn("px-3 py-2", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors",
      className
    )}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
}