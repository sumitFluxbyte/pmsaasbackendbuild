type TokenExpiryTime =
  | `${number}y`
  | `${number} days`
  | `${number}d`
  | `${number} hrs`
  | `${number}h`
  | `${number}m`
  | `${number}s`;

export type Settings = {
  port: string;
  jwt: {
    tokenCookieKey: string;
    tokenCookieKeyConsole: string;
    refreshTokenCookieKey: string;
    refreshTokenCookieKeyConsole: string;
    tokenCookieKeyDigital: string;
    refreshTokenCookieKeyDigital: string;
    tokenExipryTime: TokenExpiryTime;
    refreshTokenExipryTime: TokenExpiryTime;
    privateKey: string;
  };
  encryption: {
    saltRound: number;
  };
  emailCredentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  appURL: string;
  adminURL: string;
  user: {
    username: string;
    password: string;
  };
  noReplyEmailId: string;
  googleCredentials: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  awsBucketCredentials: {
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
  environment: string;
  domain: string;
  hours: number;
  brevoApiKey: string;
  digitalFrontendURL: string;
};

const {
  PORT,
  PRIVATE_KEY_FOR_JWT,
  EMAIL_ACCESS_KEY_ID,
  EMAIL_SECRET_ACCESS_KEY,
  EMAIL_REGION,
  APP_URL,
  ROOT_USER_USERNAME,
  ROOT_USER_PASSWORD,
  NO_REPLY_EMAIL,
  GOOGLE_CLIENT_ID,
  GOOGLE_SECRET,
  GOOGLE_CALLBACK_URL,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_BUCKET_NAME,
  ENV_NAME,
  ADMIN_URL,
  BREVO_API_KEY,
} = process.env;

if (!PRIVATE_KEY_FOR_JWT) {
  throw Error("Missing jwt private key in .env");
}
if (!EMAIL_ACCESS_KEY_ID || !EMAIL_SECRET_ACCESS_KEY) {
  throw Error("Missing email credentials in .env");
}

if (!EMAIL_REGION) {
  throw Error("Missing email region in .env");
}

if (!APP_URL) {
  throw Error("Missing APP_URL in .env");
}

if (!PRIVATE_KEY_FOR_JWT) {
  throw Error("Missing jwt private key in .env");
}

if (!ROOT_USER_USERNAME || !ROOT_USER_PASSWORD) {
  console.warn("Missing username and password");
}

if (!NO_REPLY_EMAIL) {
  throw Error("Missing NO_REPLY_EMAIL in .env");
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_SECRET || !GOOGLE_CALLBACK_URL) {
  throw Error(
    "Missing GOOGLE_CLIENT_ID, GOOGLE_SECRET and GOOGLE_CALLBACK_URL in .env"
  );
}

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_BUCKET_NAME) {
  throw Error(
    "Missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_BUCKET_NAME in .env"
  );
}
if (!ENV_NAME) {
  throw Error("Missing ENV_NAME in .env");
}

if (!ADMIN_URL) {
  throw Error("Missing ADMIN_URL in .env");
}

if (!BREVO_API_KEY) {
  throw Error("Missing BREVO_API_KEY in .env");
}

export const settings: Settings = {
  port: PORT! ?? 8000,
  jwt: {
    tokenCookieKey: "token",
    tokenCookieKeyConsole: "token-console",
    refreshTokenCookieKey: "refresh-token",
    refreshTokenCookieKeyConsole: "refresh-token-console",
    tokenCookieKeyDigital: "token-digital",
    refreshTokenCookieKeyDigital: "refresh-token-digital",
    tokenExipryTime: `1 days`,
    refreshTokenExipryTime: `7 days`,
    privateKey: PRIVATE_KEY_FOR_JWT,
  },
  encryption: {
    saltRound: 10,
  },
  emailCredentials: {
    accessKeyId: EMAIL_ACCESS_KEY_ID,
    secretAccessKey: EMAIL_SECRET_ACCESS_KEY,
    region: EMAIL_REGION,
  },
  appURL: APP_URL,
  adminURL: ADMIN_URL,
  user: {
    username: ROOT_USER_USERNAME ?? "",
    password: ROOT_USER_PASSWORD ?? "",
  },
  noReplyEmailId: NO_REPLY_EMAIL,
  googleCredentials: {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_SECRET,
    callbackUrl: GOOGLE_CALLBACK_URL,
  },
  awsBucketCredentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    bucketName: AWS_BUCKET_NAME,
  },
  environment: ENV_NAME,
  domain: ".projectchef.io",
  hours: 24,
  brevoApiKey: BREVO_API_KEY,
  digitalFrontendURL: "https://digital-app.projectchef.io"
};
