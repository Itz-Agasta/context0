import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

interface DeploymentSuccessData {
	userEmail: string;
	userName: string;
	sessionKey: string;
	contractId: string;
	deploymentTime: Date;
}

export class MailService {
	private fromEmail = process.env.EMAIL_SERVICE_USER;
	private transporter;

	constructor() {
		this.transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: process.env.EMAIL_SERVICE_USER,
				pass: process.env.EMAIL_SERVICE_PASS,
			},
		});
	}

	async sendDeploymentSuccess(data: DeploymentSuccessData): Promise<boolean> {
		try {
			const { userEmail, userName, sessionKey, contractId, deploymentTime } =
				data;

			const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Context0 Contract is Live!</title>
        </head>
        <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Deployment Successful!
              </h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                Your Context0 contract is now live on the network
              </p>
            </div>
            <!-- Main Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #1f2937; font-size: 18px; margin: 0 0 20px 0; line-height: 1.6;">
                Hey ${userName}! 👋
              </p>
              
              <p style="color: #4b5563; font-size: 16px; margin: 0 0 30px 0; line-height: 1.6;">
                Congratulations! Your contract has been successfully deployed to Context0.
                You're now part of the next generation of decentralized storage solutions.
              </p>
              <!-- Credentials Card -->
              <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0;">
                <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
                  🔐 Your Access Credentials
                </h3>
                
                <div style="margin-bottom: 16px;">
                  <p style="color: #64748b; margin: 0 0 4px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                    Session Key
                  </p>
                  <div style="background: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; font-family: 'SF Mono', Consolas, monospace; font-size: 14px; color: #1f2937; word-break: break-all;">
                    ${sessionKey}
                  </div>
                </div>
                
                <div>
                  <p style="color: #64748b; margin: 0 0 4px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                    Contract ID
                  </p>
                  <div style="background: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; font-family: 'SF Mono', Consolas, monospace; font-size: 14px; color: #1f2937; word-break: break-all;">
                    ${contractId}
                  </div>
                </div>
              </div>
              <!-- Warning Box -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h4 style="color: #92400e; margin: 0 0 8px 0; font-size: 16px; font-weight: 600; display: flex; align-items: center;">
                  ⚠️ Important Security Notice
                </h4>
                <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>Keep these credentials safe!</strong> Your session key and contract ID are essential for accessing your Context0 storage.
                  Store them in a secure password manager and never share them with anyone.
                </p>
              </div>
              <!-- Deployment Info -->
              <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h4 style="color: #0c4a6e; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
                  Deployment Details
                </h4>
                <p style="color: #0369a1; margin: 0; font-size: 14px;">
                  <strong>Deployed at:</strong> ${deploymentTime.toLocaleString(
										"en-US",
										{
											weekday: "long",
											year: "numeric",
											month: "long",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
											timeZoneName: "short",
										}
									)}
                </p>
              </div>
              <!-- Next Steps -->
              <div style="margin: 30px 0;">
                <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
                  What's Next?
                </h3>
                <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Visit our website to see the installation instructions</li>
                  <li>Start uploading your data to your personal Context0 storage</li>
                  <li>Explore our dashboard to monitor your storage usage</li>
                  <li>Set up automated backups for your critical memories</li>
                  <li>Join our community for tips and best practices</li>
                </ul>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
                Need help? Our support team is here 24/7. Just reply to this email or visit our
                <a href="https://discord.gg/EmmFRZXMSK" style="color: #4f46e5; text-decoration: none;">Discord</a>.
              </p>
            </div>
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">
                Built with ❤️ by Team Vyse!
              </p>
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                This email was sent because you deployed a contract on Context0.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

			const result = await this.transporter.sendMail({
				from: this.fromEmail,
				to: userEmail,
				subject:
					"Your Context0 Contract is Live! Important Access Details Inside",
				html: htmlContent,
			});

			console.log(
				"Deployment success email sent successfully:",
				result.messageId
			);
			return true;
		} catch (error) {
			console.error("Mail service error:", error);
			return false;
		}
	}
}

export const mailService = new MailService();
