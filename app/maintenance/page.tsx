export default function MaintenancePage() {
  const title =
    process.env.SITE_MAINTENANCE_TITLE ??
    "Website Under Maintenance";
  const message =
    process.env.SITE_MAINTENANCE_MESSAGE ??
    "Sorry, KOOKA Residence booking services and website are currently undergoing maintenance. We will be back online as soon as possible.";
  const expected = process.env.SITE_MAINTENANCE_EXPECTED ?? "";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background:
          "linear-gradient(135deg, #f5efe6 0%, #ebe2d2 45%, #f2e6d6 100%)",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        color: "#1f2937",
      }}
    >
      <section
        style={{
          maxWidth: "720px",
          width: "min(94vw, 720px)",
          borderRadius: "20px",
          border: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#fff",
          boxShadow: "0 18px 40px -28px rgba(0, 0, 0, 0.45)",
          padding: "3rem 2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#0f766e",
            marginBottom: "1rem",
            fontSize: "0.82rem",
          }}
        >
          KOOKA Residence Surabaya
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "2.1rem",
            lineHeight: 1.2,
            color: "#111827",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: "1.05rem",
            marginTop: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {message}
        </p>
        {expected ? (
          <p style={{ margin: 0, color: "#374151" }}>
            Diperkirakan aktif kembali: <strong>{expected}</strong>
          </p>
        ) : (
          <p style={{ margin: 0, color: "#374151" }}>
            Thank you for your understanding.
          </p>
        )}
      </section>
    </main>
  );
}
