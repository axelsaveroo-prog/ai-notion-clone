import { prisma } from "@/lib/prisma";

export interface MentionNotificationParams {
  type: "task" | "schedule" | "chat" | "doc";
  authorName: string;
  authorEmail?: string | null;
  authorImage?: string | null;
  itemTitle: string;
  itemUrl: string;
  assignees?: string[];
  snippetText?: string;
  recipientEmails?: string[];
}

/**
 * Generate Notion-like HTML email for mentions/tags
 * Matching the exact visual layout from Notion's notification emails
 */
export function generateNotionMentionEmailHtml(params: {
  authorName: string;
  authorImage?: string | null;
  itemTitle: string;
  itemUrl: string;
  assignees: string[];
  type: "task" | "schedule" | "chat" | "doc";
  snippetText?: string;
}) {
  const { authorName, authorImage, itemTitle, itemUrl, assignees, snippetText } = params;
  const initial = authorName ? authorName.charAt(0).toUpperCase() : "A";
  const formattedAssignees = assignees.length > 0 ? assignees.join(", ") : "You";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${authorName} made updates in Sika Creative</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f7f7f8; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 580px; text-align: left;" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 20px;">
              <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827; letter-spacing: -0.2px;">
                ${authorName} made updates in Sika Creative
              </h1>
            </td>
          </tr>

          <!-- Notification Card (Notion Style) -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    
                    <!-- Item Title with Document Icon -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="28" valign="top" style="padding-top: 2px;">
                          <span style="font-size: 18px; line-height: 1;">📄</span>
                        </td>
                        <td valign="top">
                          <a href="${itemUrl}" style="font-size: 16px; font-weight: 700; color: #111827; text-decoration: none; display: inline-block;">
                            ${itemTitle}
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Mention Info -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 14px;">
                      <tr>
                        <td width="28" valign="top">
                          <!-- Author Avatar / Circle -->
                          <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #f3f4f6; border: 1px solid #d1d5db; color: #374151; font-size: 11px; font-weight: 700; text-align: center; line-height: 22px;">
                            ${initial}
                          </div>
                        </td>
                        <td valign="middle" style="font-size: 13px; color: #374151; line-height: 1.4;">
                          <strong style="color: #111827;">${authorName}</strong> mentioned you in this page
                        </td>
                      </tr>
                    </table>

                    <!-- Assignee List -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 12px; margin-left: 28px;">
                      <tr>
                        <td valign="middle" style="font-size: 12px; color: #6b7280;">
                          <span style="display: inline-block; margin-right: 6px; font-size: 13px;">👥</span>
                          <span style="color: #6b7280; font-weight: 500;">Assignee</span>
                          <span style="color: #111827; font-weight: 600; margin-left: 6px;">${formattedAssignees}</span>
                        </td>
                      </tr>
                    </table>

                    ${snippetText ? `
                    <!-- Snippet Note / Content -->
                    <div style="margin-top: 16px; margin-left: 28px; padding: 10px 14px; background-color: #f9fafb; border-left: 3px solid #C65921; border-radius: 4px; font-size: 12px; color: #4b5563; line-height: 1.5; font-style: italic;">
                      "${snippetText}"
                    </div>
                    ` : ""}

                    <!-- Button Action -->
                    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; text-align: right;">
                      <a href="${itemUrl}" style="background-color: #18181b; color: #ffffff; text-decoration: none; padding: 9px 18px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-block; letter-spacing: 0.1px;">
                        Open in Sika Creative →
                      </a>
                    </div>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 20px; text-align: center; font-size: 11px; color: #9ca3af; line-height: 1.5;">
              This notification was generated because you were tagged or assigned in <strong style="color: #6b7280;">Sika Creative HQ</strong>.<br>
              <a href="https://app.sikacreative.com" style="color: #C65921; text-decoration: none;">app.sikacreative.com</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send mention notification email to tagged recipients.
 * Resend API is supported if RESEND_API_KEY is configured.
 * Safely falls back to logging without ever throwing an exception.
 */
export async function sendMentionEmailNotification(params: MentionNotificationParams) {
  try {
    const {
      type,
      authorName,
      authorEmail,
      authorImage,
      itemTitle,
      itemUrl,
      assignees = [],
      snippetText,
      recipientEmails: explicitEmails,
    } = params;

    // 1. Gather all recipient email addresses
    let targetEmails: string[] = [];

    if (explicitEmails && explicitEmails.length > 0) {
      targetEmails.push(...explicitEmails);
    }

    if (assignees.length > 0) {
      try {
        const dbUsers = await prisma.user.findMany({
          select: { id: true, name: true, email: true },
        });

        for (const rawName of assignees) {
          const clean = rawName.toLowerCase().replace(/^@+/, "").trim();
          if (!clean || clean === "you" || clean === "all" || clean === "team") continue;

          const matched = dbUsers.find((u) => {
            const uName = (u.name || "").toLowerCase().trim();
            const uEmail = (u.email || "").toLowerCase().trim();
            return uName === clean || uName.includes(clean) || clean.includes(uName) || uEmail === clean;
          });

          if (matched && matched.email) {
            targetEmails.push(matched.email);
          }
        }
      } catch (err) {
        console.warn("Could not query users for email notification:", err);
      }
    }

    // Filter unique emails and exclude the author
    const normalizedAuthorEmail = (authorEmail || "").toLowerCase().trim();
    targetEmails = Array.from(new Set(targetEmails.map((e) => e.toLowerCase().trim()))).filter((e) => {
      return Boolean(e) && e.includes("@") && e !== normalizedAuthorEmail;
    });

    if (targetEmails.length === 0) {
      return { success: true, count: 0, message: "No external recipient emails found" };
    }

    const subject = `${authorName} made updates in Sika Creative`;
    const html = generateNotionMentionEmailHtml({
      authorName,
      authorImage,
      itemTitle,
      itemUrl,
      assignees,
      type,
      snippetText,
    });

    // 2. Send via Resend if RESEND_API_KEY is present
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_FROM || "Sika Creative <notifications@sikacreative.com>";

    if (resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: targetEmails,
            subject,
            html,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Successfully sent mention notification email via Resend:", data);
          return { success: true, count: targetEmails.length, data };
        } else {
          const errText = await response.text();
          console.warn("Resend API returned non-OK response:", errText);
        }
      } catch (resendError) {
        console.error("Failed to send via Resend API:", resendError);
      }
    }

    // 3. Fallback / Simulation logging
    console.log(`[EMAIL NOTIFICATION SIMULATION] Sent Notion-style mention email to [${targetEmails.join(", ")}] for item: "${itemTitle}"`);
    return { success: true, count: targetEmails.length, simulated: true };
  } catch (error) {
    console.error("Error in sendMentionEmailNotification:", error);
    return { success: false, error };
  }
}

