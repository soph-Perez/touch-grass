
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
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2F5D43] px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#D4AF37] hover:text-[#0D1F17] hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2F5D43] disabled:hover:text-white"
    >
      {children}
    </button>
  );
}
