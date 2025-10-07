const { DynamoDBClient, PutItemCommand, QueryCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb");
// ✅ Health
module.exports.hello = async () => {
  return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"
  };
}
const { v4: uuidv4 } = require("uuid");

const db = new DynamoDBClient({ region: "ap-southeast-1" });

// ✅ 1. Tạo board
module.exports.createBoard = async (event) => {
  try {
  const body = JSON.parse(event.body);
    const boardId = uuidv4();

    const item = {
      PK: { S: `BOARD#${boardId}` },
      SK: { S: `BOARD#${boardId}` },
      Type: { S: "Board" },
      title: { S: body.title },
      description: { S: body.description || "" },
      createdAt: { S: new Date().toISOString() }
    };

    await db.send(new PutItemCommand({ TableName: "KanbanApp", Item: item }));

    return {
      statusCode: 201,
      headers: corsHeaders(),
      body: JSON.stringify({ message: "Board created", boardId }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 2. Tạo task
module.exports.createTask = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const taskId = uuidv4();

    const item = {
      PK: { S: `BOARD#${body.boardId}` },
      SK: { S: `TASK#${taskId}` },
      Type: { S: "Task" },
      title: { S: body.title },
      description: { S: body.description || "" },
      status: { S: body.status || "TODO" },
      assigneeId: { S: (body.assignees && body.assignees[0]) || "unassigned" },
      assignees: { L: (body.assignees || []).map(a => ({ S: a })) },
      createdAt: { S: new Date().toISOString() },
      startDate: { S: body.startDate || "" },
      dueDate: { S: body.dueDate || "" },
      tags: { L: (body.tags || []).map(t => ({ S: t })) }
    };

    await db.send(new PutItemCommand({ TableName: "KanbanApp", Item: item }));

    return {
      statusCode: 201,
      headers: corsHeaders(),
      body: JSON.stringify({ message: "Task created", taskId }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 3. Lấy task theo board
module.exports.getTasksByBoardId = async (event) => {
  try {
    const { boardId } = event.queryStringParameters || {};
    if (!boardId) return { statusCode: 400, body: JSON.stringify({ error: "Missing boardId" }) };

    const command = new QueryCommand({
      TableName: "KanbanApp",
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": { S: `BOARD#${boardId}` },
        ":sk": { S: "TASK#" }
      }
    });

    const res = await db.send(command);
    const tasks = res.Items.map(i => ({
      id: i.SK.S.replace("TASK#", ""),
      title: i.title?.S,
      description: i.description?.S || "",
      status: i.status?.S,
      boardId: i.PK.S.replace("BOARD#", ""),
      assignees: Array.isArray(i.assignees?.L) ? i.assignees.L.map(x => x.S) : [],
      createdAt: i.createdAt?.S,
      startDate: i.startDate?.S || "",
      dueDate: i.dueDate?.S || "",
      tags: Array.isArray(i.tags?.L) ? i.tags.L.map(x => x.S) : []
    }));

    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ tasks }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 4. Lấy task theo status
module.exports.getTasksByStatus = async (event) => {
  try {
    const { status } = event.queryStringParameters || {};
    if (!status) return { statusCode: 400, body: JSON.stringify({ error: "Missing status" }) };

    const command = new QueryCommand({
      TableName: "KanbanApp",
      IndexName: "status-createdAt-index",
      KeyConditionExpression: "#s = :statusVal",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":statusVal": { S: status } }
    });

    const res = await db.send(command);
    const tasks = res.Items.map(i => ({
      id: i.SK.S.replace("TASK#", ""),
      boardId: i.PK.S.replace("BOARD#", ""),
      title: i.title?.S,
      createdAt: i.createdAt?.S
    }));

    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ tasks }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 5. Lấy task theo assignee
module.exports.getTasksByAssignee = async (event) => {
  try {
    const { assigneeId } = event.queryStringParameters || {};
    if (!assigneeId) return { statusCode: 400, body: JSON.stringify({ error: "Missing assigneeId" }) };

    const command = new QueryCommand({
      TableName: "KanbanApp",
      IndexName: "assigneeId-status-index",
      KeyConditionExpression: "assigneeId = :a",
      ExpressionAttributeValues: {
        ":a": { S: assigneeId }
      }
    });

    const res = await db.send(command);
    const tasks = res.Items.map(i => ({
      id: i.SK.S.replace("TASK#", ""),
      boardId: i.PK.S.replace("BOARD#", ""),
      title: i.title?.S,
      status: i.status?.S
    }));

    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ tasks }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 6. Lấy tất cả boards
module.exports.getAllBoards = async () => {
  try {
    const command = new ScanCommand({
      TableName: "KanbanApp",
      FilterExpression: "#t = :type",
      ExpressionAttributeNames: { "#t": "Type" },
      ExpressionAttributeValues: { ":type": { S: "Board" } }
    });

    const res = await db.send(command);
    const boards = res.Items.map(i => ({
      id: i.PK.S.replace("BOARD#", ""),
      title: i.title?.S,
      description: i.description?.S,
      createdAt: i.createdAt?.S
    }));

    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ boards }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 7. Cập nhật status task
module.exports.updateTaskStatus = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { boardId, taskId, status } = body || {};
    if (!boardId || !taskId || !status) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing fields" }) };
    }
    const cmd = new UpdateItemCommand({
      TableName: "KanbanApp",
      Key: {
        PK: { S: `BOARD#${boardId}` },
        SK: { S: `TASK#${taskId}` }
      },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": { S: status } }
    });
    await db.send(cmd);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 8. Delete a task
module.exports.deleteTask = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const qp = event.queryStringParameters || {};
    const boardId = body.boardId || qp.boardId;
    const taskId = body.taskId || qp.taskId;
    if (!boardId || !taskId) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing boardId or taskId" }) };
    }
    const cmd = new DeleteItemCommand({
      TableName: "KanbanApp",
      Key: { PK: { S: `BOARD#${boardId}` }, SK: { S: `TASK#${taskId}` } }
    });
    await db.send(cmd);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

// ✅ 9. Delete a board and all its tasks
module.exports.deleteBoard = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const qp = event.queryStringParameters || {};
    const boardId = body.boardId || qp.boardId;
    if (!boardId) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing boardId" }) };
    }
    // Query all items under the board partition
    const q = new QueryCommand({
      TableName: "KanbanApp",
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": { S: `BOARD#${boardId}` } }
    });
    const res = await db.send(q);
    const items = res.Items || [];
    if (items.length === 0) {
      // still attempt to delete the board item by key shape
    }
    // Batch write in chunks of 25
    const chunks = [];
    for (let i = 0; i < items.length; i += 25) chunks.push(items.slice(i, i + 25));
    for (const chunk of chunks) {
      let unprocessed = null;
      let attempt = 0;
      do {
        const RequestItems = {
          KanbanApp: (unprocessed || chunk).map((it) => ({ DeleteRequest: { Key: { PK: it.PK, SK: it.SK } } }))
        };
        const resp = await db.send(new BatchWriteItemCommand({ RequestItems }));
        const up = resp.UnprocessedItems && resp.UnprocessedItems.KanbanApp;
        unprocessed = up && up.length ? up.map((x) => x.DeleteRequest.Key) : null;
        attempt += 1;
      } while (unprocessed && attempt < 5);
    }
    // Also try delete board item explicitly (idempotent)
    await db.send(new DeleteItemCommand({
      TableName: "KanbanApp",
      Key: { PK: { S: `BOARD#${boardId}` }, SK: { S: `BOARD#${boardId}` } }
    }));
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};
