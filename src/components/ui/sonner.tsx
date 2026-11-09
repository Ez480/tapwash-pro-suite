import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      {...props}
      position="top-center"
      expand={false}
      visibleToasts={4}
      className="toaster group !fixed !left-1/2 !right-auto !top-4 !w-fit !max-w-[90vw] !-translate-x-1/2 !px-0"
      toastOptions={{
        ...props.toastOptions,
        classNames: {
          ...props.toastOptions?.classNames,
          toast:
            "group toast !w-fit !min-w-0 !max-w-[min(90vw,420px)] !mx-auto !rounded-2xl !border !border-white/50 !bg-background/85 !shadow-[0_12px_36px_rgba(15,23,42,0.18)] !backdrop-blur-2xl group-[.toaster]:text-foreground dark:!border-[var(--glass-panel-border)] dark:!bg-[var(--glass-panel-bg)] dark:!shadow-[var(--glass-panel-shadow)] dark:!backdrop-blur-2xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  );
};

export { Toaster };
