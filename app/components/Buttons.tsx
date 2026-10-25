
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}

export default function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#365D46] px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#294A37] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557D62] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
