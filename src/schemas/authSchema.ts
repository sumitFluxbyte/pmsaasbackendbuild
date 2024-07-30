import { z } from "zod";
import { LanguageEnumSchema, ZodErrorMessageEnumValue } from "./enums.js";

export const authSignUpSchema = z
  .object({
    firstName: z.string({ required_error: ZodErrorMessageEnumValue.REQUIRED }),
    lastName: z.string({ required_error: ZodErrorMessageEnumValue.REQUIRED }),
    email: z
      .string({ required_error: ZodErrorMessageEnumValue.REQUIRED })
      .email({ message: "Email is not valid" }),
    password: z
      .string()
      .regex(
        /^(?=.*[!@#$%^&*(),.?":{}|<>])(?=.*[A-Z])(?=.*[0-9]).{8,}$/,
        "Must contain 8+ chars, 1 uppercase, 1 lowercase, 1 number and 1 special chars."
      )
      .min(1, "Password is a required field"),
    confirmPassword: z.string({
      required_error: ZodErrorMessageEnumValue.REQUIRED,
    }),
    privacyPolicy: z.boolean().refine((v) => {
      if (v == true) {
        return true;
      }
    }),
    language: z.nativeEnum(LanguageEnumSchema).optional(),
  })
  .refine(
    (values) => {
      if (!values.password) return true;
      return values.password === values.confirmPassword;
    },
    {
      message: "Passwords must match!",
      path: ["confirmPassword"],
    }
  );

export const authLoginSchema = z.object({
  email: z
    .string({ required_error: ZodErrorMessageEnumValue.REQUIRED })
    .email({ message: "Email is not valid" }),
  password: z
    .string({ required_error: ZodErrorMessageEnumValue.REQUIRED })
    .min(1, "Password is a required field"),
});

export const authRefreshTokenSchema = z.string();

export const verifyEmailOtpSchema = z.object({
  otp: z
    .string({ required_error: ZodErrorMessageEnumValue.REQUIRED })
    .min(1, "Otp is required field"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: ZodErrorMessageEnumValue.REQUIRED })
    .email(),
});

export const resetTokenSchema = z.string().min(1, "Token is required field");

export const resetPasswordTokenSchema = z
  .object({
    password: z
      .string({ required_error: ZodErrorMessageEnumValue.REQUIRED })
      .regex(
        /^(?=.*[!@#$%^&*(),.?":{}|<>])(?=.*[A-Z])(?=.*[0-9]).{8,}$/,
        "Must contain 8+ chars, 1 uppercase, 1 lowercase, 1 number and 1 special chars."
      )
      .min(1, "Password is a required field"),
    confirmPassword: z.string({
      required_error: ZodErrorMessageEnumValue.REQUIRED,
    }),
  })
  .refine(
    (values) => {
      if (!values.password) return true;
      return values.password === values.confirmPassword;
    },
    {
      message: "Passwords must match!",
      path: ["confirmPassword"],
    }
  );
