import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !w-fit !max-w-[min(90vw,420px)] !mx-auto !rounded-2xl !border-white/50 !bg-background/85 !shadow-[0_12px_36px_rgba(15,23,42,0.18)] !backdrop-blur-2xl group-[.toaster]:text-foreground dark:!border-white/10 dark:!bg-slate-950/85",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
