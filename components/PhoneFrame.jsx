'use client';

// Bungkus tampilan mobile-first (DESIGN.md): frame "phone" untuk halaman pelaksana.
export default function PhoneFrame({ children }) {
  return (
    <div className="phone">
      <div className="phone-inner">{children}</div>
    </div>
  );
}