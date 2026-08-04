"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { KookaSelect } from "./FormControls";
import StaffNotice from "./StaffNotice";
import styles from "../staff.module.css";

type Notice = { tone: "success" | "error"; message: string } | null;

function simpleCleaningStatus(status: string) {
  if (["IN_PROGRESS", "CLEANED"].includes(status))
    return status === "IN_PROGRESS"
      ? "Sedang dibersihkan"
      : "Selesai dibersihkan";
  return "Perlu dibersihkan";
}

export function nextCleaningTaskStatus(status: string) {
  if (status === "IN_PROGRESS") return "CLEANED";
  if (status === "CLEANED") return "INSPECTED";
  return "IN_PROGRESS";
}

export function cleaningTaskActionLabel(status?: string) {
  if (status === "IN_PROGRESS") return "Tandai selesai dibersihkan";
  if (status === "CLEANED") return "Tandai sudah diperiksa";
  return "Mulai bersihkan";
}

export default function HousekeepingActions({
  maintenance = [],
  rooms = [],
  tasks,
}: {
  maintenance?: Array<{ id: string; title: string; status: string }>;
  rooms?: Array<{ id: string; roomNumber: string }>;
  tasks: Array<{
    id: string;
    roomUnitId: string | null;
    taskType: string;
    status: string;
    notes: string | null;
  }>;
}) {
  const router = useRouter();
  const [taskId, setTaskId] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [newRoomId, setNewRoomId] = useState("");
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [maintenanceRoomId, setMaintenanceRoomId] = useState("");
  const [maintenanceCategory, setMaintenanceCategory] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [maintenanceSeverity, setMaintenanceSeverity] = useState("MEDIUM");
  const [maintenanceImpact, setMaintenanceImpact] = useState("NONE");
  const [maintenanceId, setMaintenanceId] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState("TRIAGED");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const selectedTask = tasks.find((task) => task.id === taskId);
  async function send(body: Record<string, unknown>) {
    const response = await fetch("/api/staff/operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `housekeeping:${crypto.randomUUID()}`,
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: { message?: string } };
    if (!response.ok)
      throw new Error(result.error?.message ?? "Aksi gagal diproses.");
  }
  async function advanceTask(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTask) return;
    try {
      const toStatus = nextCleaningTaskStatus(selectedTask.status);
      await send({
        action: "TRANSITION_CLEANING",
        cleaningTaskId: taskId,
        toStatus,
      });
      setTaskId("");
      setNotice({
        tone: "success",
        message:
          toStatus === "IN_PROGRESS"
            ? "Pembersihan kamar dimulai."
            : toStatus === "CLEANED"
              ? "Pembersihan selesai dan menunggu pemeriksaan."
              : "Pekerjaan sudah diperiksa dan diselesaikan.",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Aksi gagal.",
      });
    }
  }
  async function generate() {
    try {
      await send({
        action: "GENERATE_DAILY_CLEANING",
        businessDate: new Date().toISOString().slice(0, 10),
      });
      setNotice({
        tone: "success",
        message:
          "Jadwal checkout, stayover, dan room move hari ini sudah dibuat.",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Jadwal gagal dibuat.",
      });
    }
  }
  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    try {
      await send({
        action: "CREATE_CLEANING",
        roomUnitId: newRoomId,
        taskType: "GUEST_REQUEST",
        priority: "NORMAL",
        entryPermission: "GRANTED",
        notes:
          newTaskNotes.trim() ||
          "Tamu meminta kamar dibersihkan dan mengizinkan petugas masuk.",
      });
      setNewRoomId("");
      setNewTaskNotes("");
      setNotice({
        tone: "success",
        message: "Permintaan cleaning berhasil dibuat.",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Tugas gagal dibuat.",
      });
    }
  }
  async function createMaintenance(event: React.FormEvent) {
    event.preventDefault();
    try {
      await send({
        action: "CREATE_MAINTENANCE",
        roomUnitId: maintenanceRoomId,
        category: maintenanceCategory,
        severity: maintenanceSeverity,
        title: maintenanceTitle,
        description: maintenanceDescription,
        serviceabilityImpact: maintenanceImpact,
      });
      setMaintenanceRoomId("");
      setMaintenanceCategory("");
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      setNotice({
        tone: "success",
        message: "Laporan maintenance berhasil dibuat.",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Laporan gagal dibuat.",
      });
    }
  }
  async function transitionMaintenance(event: React.FormEvent) {
    event.preventDefault();
    try {
      await send({
        action: "TRANSITION_MAINTENANCE",
        maintenanceIssueId: maintenanceId,
        toStatus: maintenanceStatus,
        notes: maintenanceNotes,
        returnToService: ["RESOLVED", "VERIFIED"].includes(maintenanceStatus),
      });
      setMaintenanceId("");
      setMaintenanceNotes("");
      setNotice({
        tone: "success",
        message: "Status maintenance berhasil diperbarui.",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Status gagal diperbarui.",
      });
    }
  }
  return (
    <div className={styles.actionGrid}>
      <StaffNotice notice={notice} onDismiss={() => setNotice(null)} />
      <section className={`${styles.formCard} ${styles.actionGridWide}`}>
        <div className={styles.panelHeader}>
          <h2>Pekerjaan hari ini</h2>
          <button
            className={styles.secondaryButton}
            onClick={() => void generate()}
            type="button"
          >
            Buat jadwal hari ini
          </button>
        </div>
        <form className={styles.staffForm} onSubmit={advanceTask}>
          <label>
            Kamar yang dikerjakan
            <KookaSelect
              ariaLabel="Cleaning task"
              emptyMessage="Belum ada cleaning task yang dapat diperbarui"
              value={taskId}
              onChange={setTaskId}
              options={tasks.map((task) => ({
                value: task.id,
                label: task.roomUnitId
                  ? `Kamar ${rooms.find((room) => room.id === task.roomUnitId)?.roomNumber ?? "—"}`
                  : task.taskType.replaceAll("_", " "),
                description: `${task.taskType === "GUEST_REQUEST" ? "Permintaan tamu · " : ""}${simpleCleaningStatus(task.status)}${task.notes ? ` · ${task.notes}` : ""}`,
              }))}
              placeholder="Pilih kamar yang dikerjakan"
            />
          </label>
          <button className={styles.primaryButton} disabled={!taskId}>
            {cleaningTaskActionLabel(selectedTask?.status)}
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Permintaan tamu untuk membersihkan kamar</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createTask}>
          <p className={styles.inlineHint}>
            Gunakan fitur ini saat tamu yang masih menginap meminta kamarnya
            dibersihkan dan sudah memberi izin petugas untuk masuk.
          </p>
          <label>
            Kamar
            <KookaSelect
              ariaLabel="Kamar cleaning"
              value={newRoomId}
              onChange={setNewRoomId}
              options={rooms.map((room) => ({
                value: room.id,
                label: `Kamar ${room.roomNumber}`,
              }))}
              placeholder="Pilih kamar"
            />
          </label>
          <label>
            Catatan permintaan (opsional)
            <textarea
              placeholder="Contoh: tamu sedang pergi dan meminta kamar dibersihkan"
              value={newTaskNotes}
              onChange={(event) => setNewTaskNotes(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton} disabled={!newRoomId}>
            Buat permintaan cleaning
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Laporkan maintenance</h2>
        </div>
        <form className={styles.staffForm} onSubmit={createMaintenance}>
          <label>
            Kamar
            <KookaSelect
              ariaLabel="Kamar maintenance"
              value={maintenanceRoomId}
              onChange={setMaintenanceRoomId}
              options={rooms.map((room) => ({
                value: room.id,
                label: `Kamar ${room.roomNumber}`,
              }))}
              placeholder="Pilih kamar"
            />
          </label>
          <label>
            Kategori
            <input
              required
              value={maintenanceCategory}
              onChange={(event) => setMaintenanceCategory(event.target.value)}
            />
          </label>
          <label>
            Judul
            <input
              required
              value={maintenanceTitle}
              onChange={(event) => setMaintenanceTitle(event.target.value)}
            />
          </label>
          <label>
            Deskripsi
            <textarea
              required
              value={maintenanceDescription}
              onChange={(event) =>
                setMaintenanceDescription(event.target.value)
              }
            />
          </label>
          <label>
            Severity
            <KookaSelect
              ariaLabel="Severity maintenance"
              value={maintenanceSeverity}
              onChange={setMaintenanceSeverity}
              options={[
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
                { value: "CRITICAL", label: "Critical" },
              ]}
            />
          </label>
          <label>
            Dampak kamar
            <KookaSelect
              ariaLabel="Dampak serviceability"
              value={maintenanceImpact}
              onChange={setMaintenanceImpact}
              options={[
                { value: "NONE", label: "Tidak memblokir" },
                { value: "BLOCKED", label: "Blocked" },
                { value: "OUT_OF_ORDER", label: "Out of order" },
              ]}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={!maintenanceRoomId}
          >
            Buat laporan maintenance
          </button>
        </form>
      </section>
      <section className={styles.formCard}>
        <div className={styles.panelHeader}>
          <h2>Update maintenance</h2>
        </div>
        <form className={styles.staffForm} onSubmit={transitionMaintenance}>
          <label>
            Masalah
            <KookaSelect
              ariaLabel="Maintenance issue"
              value={maintenanceId}
              onChange={setMaintenanceId}
              options={maintenance.map((issue) => ({
                value: issue.id,
                label: issue.title,
                description: issue.status,
              }))}
              placeholder="Pilih masalah"
            />
          </label>
          <label>
            Status
            <KookaSelect
              ariaLabel="Status maintenance"
              value={maintenanceStatus}
              onChange={setMaintenanceStatus}
              options={[
                { value: "TRIAGED", label: "Triaged" },
                { value: "IN_PROGRESS", label: "In progress" },
                { value: "RESOLVED", label: "Resolved" },
                { value: "VERIFIED", label: "Verified" },
                { value: "REOPENED", label: "Reopened" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </label>
          <label>
            Catatan
            <textarea
              minLength={3}
              required
              value={maintenanceNotes}
              onChange={(event) => setMaintenanceNotes(event.target.value)}
            />
          </label>
          <button className={styles.primaryButton} disabled={!maintenanceId}>
            Simpan status maintenance
          </button>
        </form>
      </section>
    </div>
  );
}
