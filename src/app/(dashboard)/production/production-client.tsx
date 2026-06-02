"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/lib/actions/production";
import { updateCorrectionStatus } from "@/lib/actions/corrections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Scissors, CheckCircle2, Send, Wrench } from "lucide-react";
import type { ProductionTask, Order, Customer, Correction } from "@/lib/db/schema";

type TaskWithOrder = ProductionTask & { order: (Order & { customer: Customer | null }) | null };
type CorrectionWithDetails = Correction & { order: Order | null; customer: Customer | null };

const columns = [
  { id: "queued" as const, label: "Čeka na red", icon: Clock, color: "text-gray-500", bg: "bg-gray-50" },
  { id: "in_progress" as const, label: "U radu", icon: Scissors, color: "text-yellow-600", bg: "bg-yellow-50" },
  { id: "done" as const, label: "Gotov", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  { id: "sent_to_store" as const, label: "Poslat u radnju", icon: Send, color: "text-blue-600", bg: "bg-blue-50" },
];

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const priorityLabels: Record<string, string> = {
  high: "Hitan",
  medium: "Srednji",
  low: "Nizak",
};

export function ProductionClient({ tasks, productionCorrections }: { tasks: TaskWithOrder[]; productionCorrections: CorrectionWithDetails[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const moveTask = (taskId: string, status: "queued" | "in_progress" | "done" | "sent_to_store") => {
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
      router.refresh();
    });
  };

  const resolveCorrection = (correctionId: string, resolved: boolean) => {
    startTransition(async () => {
      await updateCorrectionStatus(correctionId, resolved ? "resolved" : "not_resolved");
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Produkcija</h1>
        <p className="text-muted-foreground text-sm mt-1">Pregled svih aktivnih zadataka</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => {
          const count = tasks.filter(t => t.status === col.id).length;
          const Icon = col.icon;
          return (
            <Card key={col.id}><CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${col.color}`} />
                <p className="text-sm text-muted-foreground">{col.label}</p>
              </div>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </CardContent></Card>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colTasks = tasks.filter(t => t.status === col.id);
          const Icon = col.icon;
          return (
            <div key={col.id} className="space-y-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${col.bg}`}>
                <Icon className={`w-4 h-4 ${col.color}`} />
                <span className="text-sm font-medium">{col.label}</span>
                <span className="ml-auto text-xs text-muted-foreground bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-2 min-h-24">
                {colTasks.map((task) => (
                  <Card key={task.id} className="shadow-none hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium leading-tight">
                            {task.order?.item ?? "Nalog"}
                          </p>
                          {task.order?.customer && (
                            <p className="text-xs text-muted-foreground">
                              {task.order.customer.firstName} {task.order.customer.lastName}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${priorityColors[task.priority] ?? "bg-gray-100"}`}>
                          {priorityLabels[task.priority] ?? task.priority}
                        </span>
                      </div>
                      {task.order?.material && (
                        <div className="text-xs bg-muted/50 rounded px-2 py-1">{task.order.material}</div>
                      )}
                      {task.notesFromStore && (
                        <p className="text-xs italic text-muted-foreground border-l-2 pl-2">{task.notesFromStore}</p>
                      )}
                      <div className="flex items-center text-xs text-muted-foreground pt-1 border-t">
                        <Clock className="w-3 h-3 mr-1" />
                        {task.dueDate ?? "Bez roka"}
                      </div>
                      <div className="flex gap-1">
                        {col.id === "queued" && (
                          <button onClick={() => moveTask(task.id, "in_progress")} disabled={isPending}
                            className="flex-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-1.5 rounded hover:bg-yellow-200 font-medium disabled:opacity-50">
                            Počni →
                          </button>
                        )}
                        {col.id === "in_progress" && (
                          <button onClick={() => moveTask(task.id, "done")} disabled={isPending}
                            className="flex-1 text-xs bg-green-100 text-green-800 px-2 py-1.5 rounded hover:bg-green-200 font-medium disabled:opacity-50">
                            Gotovo ✓
                          </button>
                        )}
                        {col.id === "done" && (
                          <button onClick={() => moveTask(task.id, "sent_to_store")} disabled={isPending}
                            className="flex-1 text-xs bg-blue-100 text-blue-800 px-2 py-1.5 rounded hover:bg-blue-200 font-medium disabled:opacity-50">
                            Šalji u radnju →
                          </button>
                        )}
                        {col.id === "sent_to_store" && (
                          <div className="flex-1 text-xs text-center text-muted-foreground py-1">Završeno</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {colTasks.length === 0 && (
                  <div className="border-2 border-dashed rounded-lg h-20 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Nema naloga</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Korekcije u produkciji */}
      {productionCorrections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-500" />
              Korekcije u produkciji
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium ml-1">
                {productionCorrections.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {productionCorrections.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-4 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded font-medium">{c.correctionType}</span>
                    {c.customer && (
                      <span className="text-xs text-muted-foreground">{c.customer.firstName} {c.customer.lastName}</span>
                    )}
                    {c.dueDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {c.dueDate}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{c.description}</p>
                  {c.cause && <p className="text-xs text-muted-foreground mt-0.5">{c.cause}</p>}
                  {c.order && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{c.order.orderNumber} — {c.order.item ?? "—"}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => resolveCorrection(c.id, true)} disabled={isPending}
                    className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded hover:bg-green-200 font-medium disabled:opacity-50">
                    Rešeno ✓
                  </button>
                  <button onClick={() => resolveCorrection(c.id, false)} disabled={isPending}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 font-medium disabled:opacity-50">
                    Nije rešeno
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
