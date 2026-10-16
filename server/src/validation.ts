// Input validation for account fields. Messages are shown to the user verbatim.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt silently truncates beyond 72 bytes
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

export const validatePassword = (password: unknown): string | null => {
    if (typeof password !== 'string') return 'Password is required.';
    if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} bytes long.`;
    return null;
};

export const validateName = (label: string, value: unknown): string | null => {
    if (typeof value !== 'string' || !value.trim()) return `${label} is required.`;
    if (value.trim().length > NAME_MAX_LENGTH) return `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`;
    return null;
};

export const validateEmail = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value.trim()) return 'Email is required.';
    const v = value.trim();
    if (v.length > EMAIL_MAX_LENGTH) return `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
    return null;
};
