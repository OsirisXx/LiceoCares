const TermsOfService = () => {
  const sections = [
    {
      title: "1. Acceptance of these terms",
      content: "By accessing or using Liceo Cares, you agree to these Terms of Service. If you do not agree, please do not use the platform. If you use Liceo Cares on behalf of an organization, you confirm that you are authorized to accept these terms for that organization.",
    },
    {
      title: "2. Purpose of Liceo Cares",
      content: "Liceo Cares is Liceo de Cagayan University's feedback management system. It allows members of the university community to submit concerns, provide feedback, and follow the progress of submitted tickets. The platform supports the University's internal review and resolution process; it is not an emergency service.",
    },
    {
      title: "3. Your responsibilities",
      content: "Provide information that is accurate and relevant to your concern. Do not submit content that is unlawful, knowingly false, threatening, discriminatory, defamatory, obscene, or intended to harass another person. Do not upload malware, attempt to disrupt the service, access another person's account or ticket, or use the platform for commercial purposes.",
    },
    {
      title: "4. Complaints, feedback, and attachments",
      content: "You are responsible for the information and files you submit. Only upload files you are permitted to share, and avoid including unnecessary personal or sensitive information. A reference number is provided for tracking; keep it private. Anonymous submissions may be accepted, but anonymity can limit the University's ability to investigate or respond to a concern.",
    },
    {
      title: "5. Review and resolution",
      content: "Submissions are reviewed and may be verified, assigned to the appropriate department, updated, closed, or declined in accordance with University procedures. Submission does not guarantee a particular outcome, response time, or resolution. The University may contact you for clarification when contact details are available.",
    },
    {
      title: "6. Accounts and access",
      content: "Keep your sign-in credentials secure and notify the University promptly if you suspect unauthorized account use. You must not share accounts or attempt to bypass access controls. The University may suspend or restrict access when it reasonably believes these terms, University policies, or applicable law have been violated.",
    },
    {
      title: "7. Privacy and records",
      content: "Information submitted through Liceo Cares is handled for receiving, reviewing, assigning, communicating about, and resolving feedback. This may include account information, submission details, attachments, and technical information needed to operate and protect the service. Records may be retained or disclosed when required for legitimate University operations, policy enforcement, or applicable law.",
    },
    {
      title: "8. Service availability and changes",
      content: "We may modify, suspend, or discontinue any part of Liceo Cares to maintain security, perform updates, or improve the service. While we aim to keep the platform available and accurate, it is provided on an as-available basis and may occasionally be unavailable or contain errors.",
    },
    {
      title: "9. Changes to these terms",
      content: "The University may update these terms when needed. The latest version will be posted on this page, and continued use after an update means you accept the revised terms.",
    },
    {
      title: "10. Questions or concerns",
      content: "For questions about these terms or help with a submission, contact the appropriate Liceo de Cagayan University office or use the feedback process available through Liceo Cares.",
    },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <section className="bg-maroon-800 text-white py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gold-300 font-semibold text-sm uppercase tracking-[0.2em] mb-3">Liceo Cares</p>
          <h1 className="text-4xl sm:text-5xl font-bold">Terms of Service</h1>
          <p className="mt-5 text-gray-300 text-lg">Please read these terms before using the Liceo Cares Feedback Management System.</p>
        </div>
      </section>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 sm:px-10 py-6 border-b border-gray-100 bg-gold-50">
            <p className="text-sm font-medium text-maroon-800">Last updated: July 20, 2026</p>
          </div>
          <div className="px-6 sm:px-10 py-8 sm:py-10 space-y-8">
            <p className="text-gray-600 leading-7">These Terms of Service govern your use of Liceo Cares. They are intended to help keep the platform safe, respectful, and effective for the Liceo de Cagayan University community.</p>
            {sections.map(({ title, content }) => (
              <section key={title}>
                <h2 className="text-xl font-bold text-maroon-800 mb-3">{title}</h2>
                <p className="text-gray-600 leading-7">{content}</p>
              </section>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default TermsOfService;
