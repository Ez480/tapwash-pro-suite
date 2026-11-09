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
            "tapwash-floating-glass group toast !pointer-events-auto !w-fit !min-w-[min(260px,90vw)] !max-w-[min(90vw,420px)] !mx-auto !rounded-[1.35rem] group-[.toaster]:text-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  );
};

export { Toaster };
