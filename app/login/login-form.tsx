"use client";

import { useActionState } from "react";

import { Alert, Card, CardBody, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="space-y-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}

          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <Field label="Email address" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
