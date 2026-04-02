import { Card } from "antd";

export default function FeatureCard({ title, description, icon }) {
    return (
        <Card
            hoverable
            style={{
                textAlign: "center",
                borderRadius: "12px",
            }}
        >
            <div style={{ fontSize: "30px", marginBottom: 10 }}>
                {icon}
            </div>

            <h3>{title}</h3>
            <p style={{ color: "gray" }}>{description}</p>
        </Card>
    );
}