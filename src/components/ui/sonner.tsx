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
      className="toaster group"
      toastOptions={{
        ...props.toastOptions,
        duration: 2000,
        classNames: {
          ...props.toastOptions?.classNames,
          toast:
            "group toast !relative !mx-auto !flex !w-[min(90vw,380px)] !min-w-0 !max-w-[90vw] !items-center !gap-3 !rounded-[1.35rem] !border !border-white/75 !bg-white/55 !py-3 !pl-11 !pr-4 !text-start !shadow-[0_18px_48px_rgba(15,23,42,0.20),inset_0_1px_0_rgba(255,255,255,0.82)] !backdrop-blur-[28px] ![backdrop-filter:saturate(180%)_blur(28px)] group-[.toaster]:text-foreground dark:!border-[var(--glass-panel-border)] dark:!bg-[var(--glass-panel-bg)] dark:!shadow-[var(--glass-panel-shadow)] dark:!backdrop-blur-[32px]",
          content: "group-[.toast]:!min-w-0 group-[.toast]:!flex-1 group-[.toast]:!text-start",
          title: "group-[.toast]:!text-sm group-[.toast]:!font-semibold group-[.toast]:!leading-snug",
          description: "group-[.toast]:!mt-0.5 group-[.toast]:!text-xs group-[.toast]:!leading-relaxed group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:!absolute group-[.toast]:!left-3 group-[.toast]:!right-auto group-[.toast]:!top-1/2 group-[.toast]:!-translate-y-1/2 group-[.toast]:!m-0 group-[.toast]:!z-10",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  );
};

export { Toaster };
