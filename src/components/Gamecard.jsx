import { Card, Button, Progress } from "antd";

export default function GameCard({ title, description, progress }) {
    return (
        <Card
            hoverable
            style={{
                borderRadius: "12px",
            }}
        >
            <h3>{title}</h3>
            <p style={{ color: "gray" }}>{description}</p>

            <Progress percent={progress} />

            <Button type="primary" block style={{ marginTop: 10 }}>
                Play Now
            </Button>
        </Card>
    );
}