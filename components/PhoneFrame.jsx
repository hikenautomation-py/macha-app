'use client';

// Wrapper konten sempit (form pelaksana): full-width di HP, card di desktop.
export default function PhoneFrame({ children }) {
  return (
    <div className="narrow">
      <div className="panel">{children}</div>
    </div>
  );
}
