"use client"

import { useRouter } from "next/navigation"

export default function AuthCodeErrorPage() {
  const router = useRouter()

  return (
    <div className="auth-error-page">
      <div className="auth-error-card">
        <div className="auth-error-brand">CABOT</div>
        <h1 className="auth-error-headline">Sign in failed</h1>
        <p className="auth-error-body">
          Something went wrong during sign&nbsp;in.
          Please try&nbsp;again.
        </p>
        <button
          className="auth-error-button"
          onClick={() => router.push("/login")}
        >
          Back to sign in
        </button>
      </div>
    </div>
  )
}
