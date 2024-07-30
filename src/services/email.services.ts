import AWS from "aws-sdk";
import { settings } from "../config/settings.js";
import { generateOTP } from "../utils/otpHelper.js";
import { OtpService } from "./userOtp.services.js";

export class EmailService {
  static async sendEmail(
    toEmail: string,
    subjectMessage: string,
    bodyMessage: string,
    html?: string
  ) {
    AWS.config.update({
      region: settings.emailCredentials.region,
      accessKeyId: settings.emailCredentials.accessKeyId,
      secretAccessKey: settings.emailCredentials.secretAccessKey,
    });
    const ses = new AWS.SES();
    const params: AWS.SES.SendEmailRequest = {
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Body: {
          Text: {
            Data: bodyMessage,
          },
          Html: {
            Data: html ?? "",
          },
        },
        Subject: {
          Data: subjectMessage,
        },
      },
      Source: settings.noReplyEmailId,
    };
    try {
      const result = await ses.sendEmail(params).promise();
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async sendOTPTemplate(
    email: string,
    userId: string,
    tenantId: string,
    expiresInMinutes: number
  ) {
    const otpValue = generateOTP();
    const subjectMessage = `ProjectChef : One Time Password`;
    const bodyMessage = `
      Hello,

      Kindly find here your One Time Password: ${otpValue}.
      Please do not share this number with anyone.
      This number is valid for ${expiresInMinutes} minutes.

      Best Regards,
      ProjectChef Support Team
  `;
    const html = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
    
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
    
      <body>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;padding:1rem;border-radius:1rem;box-shadow:0 0 #0000, 0 0 #0000, 0 10px 15px -3px rgb(0,0,0,0.1), 0 4px 6px -4px rgb(0,0,0,0.1);border-width:1px !important;border-style:solid;border-color:rgb(209,213,219)">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;background-color:rgb(13,6,45);padding-top:0.5rem;padding-bottom:0.5rem;border-top-left-radius:1rem;border-top-right-radius:1rem;height:fit-content !important">
                  <tbody>
                    <tr style="width:100%">
                      <td><img src="https://pmsaas-uploader.s3.amazonaws.com/production/user-profiles/NewLogo.png" style="display:block;outline:none;border:none;text-decoration:none;height:4rem;box-shadow:0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgb(0,0,0,0.05) !important;margin-left:auto !important;margin-right:auto !important" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="background:rgba(0,0,0,.05);border-radius:4px;margin:16px auto 14px;vertical-align:middle;width:280px">
                  <tbody>
                    <tr>
                      <td>
                        <p style="font-size:32px;line-height:40px;margin:0 auto;color:#0D062D;display:inline-block;font-family:HelveticaNeue-Bold;font-weight:700;letter-spacing:6px;padding-bottom:8px;padding-top:8px;width:100%;text-align:center">${otpValue}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left;margin-top:1.25rem"> <!-- -->Please do not share this number with anyone.</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left"> This number is valid for 5 minutes</p>
                <p style="font-size:0.875rem;line-height:1.25rem;margin:16px 0;padding-top:0.5rem;padding-bottom:0.5rem;text-align:center;margin-top:1.25rem;gap:0.5rem;width:100%">Best Regards, <br />ProjectChef Support Team</p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
            `;
    try {
      await OtpService.saveOTP(
        otpValue,
        userId,
        tenantId,
        expiresInMinutes * 60
      );

      await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
    } catch (error) {
      console.error("Failed to send OTP", error);
    }
  }

  static async sendResetPasswordTemplate(email: string, token: string) {
    const subjectMessage = `Reset your ProjectChef password`;
    const bodyMessage = `
      Hello,

      We have received your request for password reset for ProjectChef on this account : ${email}. 
      If you don't want to reset your password, you can ignore this email.
      If you have received this email in error or you suspect fraud, please let us know at support@projectchef.io
      URL: ${settings.appURL}/reset-password/?token=${token}

      Best Regards,
      ProjectChef Support Team

  `;
    const html = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
    
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
    
      <body>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;padding:1rem;border-radius:1rem;box-shadow:0 0 #0000, 0 0 #0000, 0 10px 15px -3px rgb(0,0,0,0.1), 0 4px 6px -4px rgb(0,0,0,0.1);border-width:1px !important;border-style:solid;border-color:rgb(209,213,219)">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;background-color:rgb(13,6,45);padding-top:0.5rem;padding-bottom:0.5rem;border-top-left-radius:1rem;border-top-right-radius:1rem;height:fit-content !important">
                  <tbody>
                    <tr style="width:100%">
                      <td><img src="https://pmsaas-uploader.s3.amazonaws.com/production/user-profiles/NewLogo.png" style="display:block;outline:none;border:none;text-decoration:none;height:4rem;box-shadow:0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgb(0,0,0,0.05) !important;margin-left:auto !important;margin-right:auto !important" /></td>
                    </tr>
                  </tbody>
                </table>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0px;text-align:left;margin-top:10px"> <!-- -->We have received your request for password reset for ProjectChef on this account: ${email}.</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0px;text-align:left;margin-top:10px"> <!-- -->If you don&#x27;t want to reset your password, you can ignore this email.</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0px;text-align:left;margin-top:20px">If you have received this email in error or you suspect fraud, please let us know at support@projectchef.io.</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0px;text-align:center;margin-top:1.25rem;margin-bottom:1.25rem"><a href="${settings.appURL}reset-password/?token=${token}" style="color:#444;text-decoration:underline" target="_blank">Click here to reset password</a></p>
                <p style="font-size:0.875rem;line-height:1.25rem;margin:16px 0;padding-top:0.5rem;padding-bottom:0.5rem;text-align:center;margin-top:1.25rem;gap:0.5rem;width:100%">Best Regards, <br />ProjectChef Support Team</p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    
    </html>
    `;
    try {
      await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
    } catch (error) {
      console.error("Failed to send Email", error);
    }
  }

  static async sendInvitationInConsoleTemplate(
    email: string,
    randomPassword: string
  ) {
    const subjectMessage = `Invited`;
    const bodyMessage = `
      You are invited in console
      
      URL: ${settings.adminURL}login
      LOGIN: ${email}
      PASSWORD: ${randomPassword}
      `;
    const html = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
    
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
    
      <body>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;padding:1rem;border-radius:1rem;box-shadow:0 0 #0000, 0 0 #0000, 0 10px 15px -3px rgb(0,0,0,0.1), 0 4px 6px -4px rgb(0,0,0,0.1);border-width:1px !important;border-style:solid;border-color:rgb(209,213,219)">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;background-color:rgb(13,6,45);padding-top:0.5rem;padding-bottom:0.5rem;border-top-left-radius:1rem;border-top-right-radius:1rem;height:fit-content !important">
                  <tbody>
                    <tr style="width:100%">
                      <td><img src="https://pmsaas-uploader.s3.amazonaws.com/production/user-profiles/NewLogo.png" style="display:block;outline:none;border:none;text-decoration:none;height:4rem;box-shadow:0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgb(0,0,0,0.05) !important;margin-left:auto !important;margin-right:auto !important" /></td>
                    </tr>
                  </tbody>
                </table>
                <p class="text-semibold" style="font-size:1.25rem;line-height:1.75rem;margin:16px 0;margin-top:0.5rem;text-align:left;font-weight:400;color:rgb(75,85,99)">Hello,</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left;margin-top:10px"> <!-- -->${email}  You are invited in console on ProjectChef.</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left;margin-top:10px"> <!-- -->Please use the information bellow to login:</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left;margin-top:20px"> <!-- -->Url:<!-- --> <a href="${settings.adminURL}login" style="color:#444;text-decoration:underline" target="_blank">${settings.adminURL}login</a></p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left">Email: ${email}</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left">Password: ${randomPassword}</p>
                <p style="font-size:0.875rem;line-height:1.25rem;margin:16px 0;padding-top:0.5rem;padding-bottom:0.5rem;text-align:center;margin-top:1.25rem;gap:0.5rem;width:100%">Best Regards, <br />ProjectChef Support Team</p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    
    </html>
    `;
    try {
      await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
    } catch (error) {
      console.error("Failed to send Email", error);
    }
  }

  static async sendEmailForAddUserToOrganisationTemplate(
    organisationName: string,
    adminName: string,
    email: string,
    randomPassword: string
  ) {
    const subjectMessage = `You've been Invited to ${organisationName} organization `;
    const bodyMessage = `
      Hello,

      ${adminName} invited you to his/her Organization 
      ${organisationName} on ProjectChef.
      Please use the information bellow to login:
      
      URL: ${settings.appURL}login
      LOGIN: ${email}
      PASSWORD: ${randomPassword}

      Best Regards,
      ProjectChef Support Team

      `;
    const html = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
    
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
    
      <body>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;padding:1rem;border-radius:1rem;box-shadow:0 0 #0000, 0 0 #0000, 0 10px 15px -3px rgb(0,0,0,0.1), 0 4px 6px -4px rgb(0,0,0,0.1);border-width:1px !important;border-style:solid;border-color:rgb(209,213,219)">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;background-color:rgb(13,6,45);padding-top:0.5rem;padding-bottom:0.5rem;border-top-left-radius:1rem;border-top-right-radius:1rem;height:fit-content !important">
                  <tbody>
                    <tr style="width:100%">
                      <td><img src="https://pmsaas-uploader.s3.amazonaws.com/production/user-profiles/NewLogo.png" style="display:block;outline:none;border:none;text-decoration:none;height:4rem;box-shadow:0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgb(0,0,0,0.05) !important;margin-left:auto !important;margin-right:auto !important" /></td>
                    </tr>
                  </tbody>
                </table>
                <p class="text-semibold" style="font-size:1.25rem;line-height:1.75rem;margin:16px 0;margin-top:0.5rem;text-align:left;font-weight:400;color:rgb(75,85,99)">Hello,</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left;margin-top:10px"> <!-- -->${adminName} invited you to his/her Organization  ${organisationName} on ProjectChef.</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left;margin-top:10px"> <!-- -->Please use the information bellow to login:</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left;margin-top:20px"> <!-- -->Url:<!-- --> <a href="${settings.appURL}login" style="color:#444;text-decoration:underline" target="_blank">${settings.appURL}login</a></p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left">Email: ${email}</p>
                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 0;text-align:left">Password: ${randomPassword}</p>
                <p style="font-size:0.875rem;line-height:1.25rem;margin:16px 0;padding-top:0.5rem;padding-bottom:0.5rem;text-align:center;margin-top:1.25rem;gap:0.5rem;width:100%">Best Regards, <br />ProjectChef Support Team</p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    
    </html>
    `;
    try {
      await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
    } catch (error) {
      console.error("Failed to send Email", error);
    }
  }

  static async sendDueTaskTemplate(
    email: string,
    nameOfUser: string,
    taskNamesString: string
  ) {
    const subjectMessage = `ProjectChef: Task Due Today`;
    let message = `
      Hello ${nameOfUser}
      
      Please note that these tasks are due today:
      Task ${taskNamesString} is due today.
      
      Best Regards,
      ProjectChef Support Team
      `;
    const html = `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html dir="ltr" lang="en">
      
        <head>
          <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
        </head>
      
        <body>
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;padding:1rem;border-radius:1rem;box-shadow:0 0 #0000, 0 0 #0000, 0 10px 15px -3px rgb(0,0,0,0.1), 0 4px 6px -4px rgb(0,0,0,0.1);border-width:1px !important;border-style:solid;border-color:rgb(209,213,219)">
            <tbody>
              <tr style="width:100%">
                <td>
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;background-color:rgb(13,6,45);padding-top:0.5rem;padding-bottom:0.5rem;border-top-left-radius:1rem;border-top-right-radius:1rem;height:fit-content !important">
                    <tbody>
                      <tr style="width:100%">
                        <td><img src="https://pmsaas-uploader.s3.amazonaws.com/production/user-profiles/NewLogo.png" style="display:block;outline:none;border:none;text-decoration:none;height:4rem;box-shadow:0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgb(0,0,0,0.05) !important;margin-left:auto !important;margin-right:auto !important" /></td>
                      </tr>
                    </tbody>
                  </table>
                  <p class="text-semibold" style="font-size:1.25rem;line-height:1.75rem;margin:16px 0;margin-top:0.5rem;text-align:left;font-weight:400;color:rgb(75,85,99)">Hello ${nameOfUser},</p>
                  <p style="font-size:1rem;line-height:1.5rem;margin:16px 0;margin-top:1rem;margin-bottom:1rem;text-align:left;font-weight:400;color:rgb(75,85,99)">Please note that these tasks are due today: </p>
                  ${taskNamesString.split(",").map((d) => {
                    return `
                 
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;padding-top:0.5rem;padding-bottom:0.5rem;color:rgb(107,114,128);margin-top:0.75rem;margin-bottom:0.75rem;border-width:1px;border-style:solid;border-color:rgb(209,213,219);gap:0.5rem;width:100%;box-shadow:0 0 #0000, 0 0 #0000, 0px 3px 16px 0px #2F536D1F;border-radius:0.375rem">
                    <tbody>
                      <tr style="width:100%">
                        <td>
                          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%">
                            <tbody style="width:100%">
                              <tr style="width:100%">
                                <td data-id="__react-email-column">
                                  <p style="font-size:1.25rem;line-height:1.75rem;margin:16px 0;margin-top:0.5rem;margin-bottom:0.5rem;font-weight:600;margin-left:0.5rem;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important">${d}</p>
                                </td>
                                <td data-id="__react-email-column"><a href="${settings.appURL}mytasks?todayDueDays=true" style="color:rgb(255,255,255);text-decoration:none;padding-top:0.5rem;padding-bottom:0.5rem;padding-left:0.625rem;padding-right:0.625rem;height:fit-content;width:fit-content;display:flex;margin-left:auto;background-color:rgb(41,157,145);box-shadow:0 0 #0000, 0 0 #0000, 0 1px 3px 0 rgb(0,0,0,0.1), 0 1px 2px -1px rgb(0,0,0,0.1);border-radius:9999px;margin-right:0.5rem" target="_blank">access task</a></td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  `;
                  })}
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding-top:0.5rem;padding-bottom:0.5rem;text-align:center;margin-top:1.25rem;gap:0.5rem;width:100%">
                    <tbody>
                      <tr>
                        <td>Best Regards, <br />ProjectChef Support Team</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      
      </html>
    `;
    try {
      await EmailService.sendEmail(email, subjectMessage, message, html);
    } catch (error) {
      console.error("Error while sending duetask email", error);
    }
  }
}
