import { Landmark, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { ThemeControls } from "@/components/theme-controls";
export default function Login() {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <div className="brand">
          <Landmark size={40} />
          <span>
            Municipalidad de
            <br />
            Villa del Roble
          </span>
        </div>
        <div className="intro">
          <p className="eyebrow">Concejo municipal</p>
          <h1>
            Información clara.
            <br />
            Mejores decisiones.
          </h1>
          <p>
            Un espacio para preparar cada sesión, consultar antecedentes y
            acompañar el desarrollo de nuestra comuna.
          </p>
        </div>
        <div className="institutional-foot">
          <ShieldCheck size={24} />
          <p>
            Espacio institucional privado
            <br />
            <small>Municipalidad ficticia · Entorno de demostración</small>
          </p>
        </div>
      </aside>
      <main id="contenido" className="auth-main">
        <div style={{ width: "100%", maxWidth: 430 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 24,
            }}
          >
            <ThemeControls />
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
