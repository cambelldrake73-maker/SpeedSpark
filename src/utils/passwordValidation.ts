export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: 'length',
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      id: 'upper',
      label: 'One uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lower',
      label: 'One lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'One number',
      met: /\d/.test(password),
    },
  ];
}

export function passwordMeetsRequirements(password: string): boolean {
  return getPasswordRequirements(password).every((req) => req.met);
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword;
}
