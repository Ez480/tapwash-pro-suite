import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      {...props}
      position="top-center"
      expand={false}
      visibleToasts={4}
      duration={2000}
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: "50%", right: "auto", transform: "translateX(-50%)", width: "fit-content", maxWidth: "90vw" }}
      className="toaster group !fixed !w-fit !max-w-[90vw] !px-0"
      toastOptions={{
        ...props.toastOptions,
        duration: 2000,
        classNames: {
          ...props.toastOptions?.classNames,
          toast:
            "group toast !pointer-events-auto !w-fit !min-w-[min(260px,90vw)] !max-w-[min(90vw,420px)] !mx-auto !rounded-[1.35rem] !border !border-white/75 !bg-white/55 !shadow-[0_18px_48px_rgba(15,23,42,0.20),inset_0_1px_0_rgba(255,255,255,0.82)] !backdrop-blur-[28px] ![backdrop-filter:saturate(180%)_blur(28px)] group-[.toaster]:text-foreground dark:!border-[var(--glass-panel-border)] dark:!bg-[var(--glass-panel-bg)] dark:!shadow-[var(--glass-panel-shadow)] dark:!backdrop-blur-[32px]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  );
};

export { Toaster };
