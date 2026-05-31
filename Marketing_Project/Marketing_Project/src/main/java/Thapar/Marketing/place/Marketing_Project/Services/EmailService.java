package Thapar.Marketing.place.Marketing_Project.Services;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Async
    public void sendVerificationOtp(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("noreply@thaparmart.in");
            helper.setTo(toEmail);
            helper.setSubject("ThaparMart – Verify your email (" + otp + ")");
            helper.setText(buildHtmlEmail(otp), true);

            mailSender.send(message);
        } catch (MessagingException e) {
            System.err.println("[EmailService] Failed to send OTP to " + toEmail + ": " + e.getMessage());
        }
    }

    private String buildHtmlEmail(String otp) {
        return """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f0eb; margin:0; padding:0; }
                .wrapper { max-width:480px; margin:40px auto; background:#fff;
                           border-radius:18px; border:1.5px solid #e2e2da;
                           box-shadow:0 4px 20px rgba(0,0,0,0.08); overflow:hidden; }
                .header { background:#fc5f03; padding:28px 32px; text-align:center; }
                .header h1 { color:#fff; margin:0; font-size:24px; font-weight:800;
                             letter-spacing:-0.03em; }
                .body { padding:32px; text-align:center; }
                .otp-box { display:inline-block; background:#fff5f0;
                           border:2px solid #fc5f03; border-radius:14px;
                           padding:18px 36px; margin:20px 0;
                           font-size:36px; font-weight:800; letter-spacing:10px;
                           color:#fc5f03; }
                p { color:#444; font-size:14px; line-height:1.7; margin:0 0 12px; }
                .footer { padding:16px 32px; text-align:center;
                          color:#aaa; font-size:12px;
                          border-top:1.5px solid #f0f0eb; }
              </style>
            </head>
            <body>
              <div class="wrapper">
                <div class="header">
                  <h1>🏛️ ThaparMart</h1>
                </div>
                <div class="body">
                  <p>Use the code below to verify your <strong>@thapar.edu</strong> email address.</p>
                  <div class="otp-box">%s</div>
                  <p>This code expires in <strong>10 minutes</strong>.<br/>
                     If you didn't register, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                  ThaparMart · Campus Marketplace · Thapar Institute of Engineering &amp; Technology
                </div>
              </div>
            </body>
            </html>
            """.formatted(otp);
    }
}
