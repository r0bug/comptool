const prisma = require("../config/database");

// ─── Create a task ──────────────────────────────────────

async function createTask({ clientId, type, payload, priority = 0, maxRetries = 2, expiresAt = null }) {
  return prisma.task.create({
    data: { clientId, type, payload, priority, maxRetries, expiresAt },
  });
}

// ─── Claim next pending task for a machine ──────────────

async function claimTask(machineId, clientId, { types } = {}) {
  // Find oldest pending task for this client, optionally filtered by type
  const where = {
    clientId,
    status: "pending",
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ],
  };
  if (types && types.length > 0) {
    where.type = { in: types };
  }

  const task = await prisma.task.findFirst({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  if (!task) return null;

  // Atomically claim it (optimistic: only if still pending)
  return prisma.task.update({
    where: { id: task.id, status: "pending" },
    data: {
      status: "claimed",
      machineId,
      claimedAt: new Date(),
    },
  }).catch(() => null); // another worker beat us
}

// ─── Update task status ─────────────────────────────────

async function updateTaskStatus(taskId, { status, result, errorMessage }) {
  const data = { status };
  if (result !== undefined) data.result = result;
  if (errorMessage !== undefined) data.errorMessage = errorMessage;
  if (status === "done" || status === "failed") {
    data.completedAt = new Date();
  }
  return prisma.task.update({ where: { id: taskId }, data });
}

// ─── Retry or fail a task ───────────────────────────────

async function failTask(taskId, errorMessage) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return null;

  if (task.retryCount < task.maxRetries) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        status: "pending",
        machineId: null,
        claimedAt: null,
        retryCount: { increment: 1 },
        errorMessage,
      },
    });
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage,
    },
  });
}

// ─── List tasks with filters ────────────────────────────

async function listTasks({ clientId, status, machineId, type, limit = 50, offset = 0 } = {}) {
  const where = {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;
  if (machineId) where.machineId = machineId;
  if (type) where.type = type;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, total };
}

// ─── Get single task ────────────────────────────────────

async function getTask(taskId) {
  return prisma.task.findUnique({ where: { id: taskId } });
}

// ─── Cancel a task ──────────────────────────────────────

async function cancelTask(taskId) {
  return prisma.task.update({
    where: { id: taskId },
    data: { status: "cancelled", completedAt: new Date() },
  });
}

// ─── Queue stats ────────────────────────────────────────

async function getQueueStats(clientId) {
  const where = clientId ? { clientId } : {};
  const [pending, claimed, running, done, failed] = await Promise.all([
    prisma.task.count({ where: { ...where, status: "pending" } }),
    prisma.task.count({ where: { ...where, status: "claimed" } }),
    prisma.task.count({ where: { ...where, status: "running" } }),
    prisma.task.count({ where: { ...where, status: "done" } }),
    prisma.task.count({ where: { ...where, status: "failed" } }),
  ]);
  return { pending, claimed, running, done, failed, total: pending + claimed + running + done + failed };
}

// ─── Expire stale claimed tasks ─────────────────────────

async function expireStaleTasks(staleMinutes = 10) {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const stale = await prisma.task.findMany({
    where: {
      status: { in: ["claimed", "running"] },
      updatedAt: { lt: cutoff },
    },
  });

  for (const task of stale) {
    await failTask(task.id, `Timed out after ${staleMinutes} minutes`);
  }

  return stale.length;
}

module.exports = {
  createTask,
  claimTask,
  updateTaskStatus,
  failTask,
  listTasks,
  getTask,
  cancelTask,
  getQueueStats,
  expireStaleTasks,
};
