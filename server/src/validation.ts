// Input validation for account fields. Messages are shown to the user verbatim.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt silently truncates beyond 72 bytes
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;
export const PHONE_MAX_LENGTH = 50;
export const CITY_MAX_LENGTH = 200;
export const ADDRESS_MAX_LENGTH = 1000;
export const AVATAR_MAX_LENGTH = 90_000; // ~64 KB base64 image

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

export const validateProfileUpdates = (fields: {
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
    address?: unknown;
    defaultCity?: unknown;
    profilePictureUrl?: unknown;
}): string | null => {
    if (fields.firstName !== undefined && fields.firstName !== null) {
        const err = validateName('First name', fields.firstName);
        if (err) return err;
    }
    if (fields.lastName !== undefined && fields.lastName !== null) {
        const err = validateName('Last name', fields.lastName);
        if (err) return err;
    }
    if (fields.phone !== undefined && fields.phone !== null) {
        if (typeof fields.phone !== 'string' || fields.phone.length > PHONE_MAX_LENGTH) {
            return `Phone must be ${PHONE_MAX_LENGTH} characters or fewer.`;
        }
    }
    if (fields.defaultCity !== undefined && fields.defaultCity !== null) {
        if (typeof fields.defaultCity !== 'string' || fields.defaultCity.length > CITY_MAX_LENGTH) {
            return `Default city must be ${CITY_MAX_LENGTH} characters or fewer.`;
        }
    }
    if (fields.address !== undefined && fields.address !== null) {
        if (typeof fields.address !== 'string' || fields.address.length > ADDRESS_MAX_LENGTH) {
            return `Address must be ${ADDRESS_MAX_LENGTH} characters or fewer.`;
        }
    }
    if (fields.profilePictureUrl !== undefined && fields.profilePictureUrl !== null && fields.profilePictureUrl !== '') {
        if (typeof fields.profilePictureUrl !== 'string' || fields.profilePictureUrl.length > AVATAR_MAX_LENGTH) {
            return 'Profile picture is too large.';
        }
        const isSafeDataImage = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(fields.profilePictureUrl);
        const isSafeHttps = /^https:\/\/[^\s<>"']+$/i.test(fields.profilePictureUrl);
        if (!isSafeDataImage && !isSafeHttps) {
            return 'Profile picture must be a valid image or HTTPS URL.';
        }
    }
    return null;
};
