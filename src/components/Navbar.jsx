import { Layout, Button } from "antd";
import { useNavigate } from "react-router-dom";

const { Header } = Layout;

export default function Navbar() {
    const navigate = useNavigate();

    return (
        <Header
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#001529",
            }}
        >
            {/* Logo */}
            <h2 style={{ color: "#fff", margin: 0, cursor: "pointer" }}>
                NetraSync
            </h2>

            {/* Navigation */}
            <div>
                <Button type="link" style={{ color: "#fff" }} onClick={() => navigate("/login")}>
                    Login
                </Button>

                <Button type="link" style={{ color: "#fff" }}>
                    Home
                </Button>

                <Button type="link" style={{ color: "#fff" }}>
                    Features
                </Button>

                <Button
                    type="primary"
                    onClick={() => navigate("/register")}
                >
                    Get Started
                </Button>
            </div>
        </Header>
    );
}