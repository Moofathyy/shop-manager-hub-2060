import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-13 w-full rounded-input border border-neutral-4 bg-background px-4 py-2 text-body text-neutral-1 placeholder:text-neutral-4",
          "focus:outline-none focus:border-primary focus:border-2 focus:px-[15px]",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-primary-disabled",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
