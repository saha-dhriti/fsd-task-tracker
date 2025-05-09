const Task = require("../models/task");
const User = require("../models/user_master");
const Status = require("../models/status");
const Project = require("../models/project");

exports.getAddTask = async (req, res, next) => {
  // Find users whose role role_name is "User"
  const task_owner = await User.find({ "role.role_name": "User" });
  console.log("Task Owner:", task_owner);

  const status = await Status.find();

  const projectId = req.params.projectId;
  console.log('Project Id:', projectId)

  res.render("task/task", {
    pageTitle: "Add Task",
    task_owner: task_owner,
    path: "/task/task",
    isAuthenticated: true,
    project_id: projectId, // 👈 pass it like this
    status: status,
    userRole: req.session.user.role.role_name,
    userName: req.session.user.name,
    editing: false
  });
};

exports.postAddTask = (req, res, next) => {
  console.log("Task details:", req.body);
  const task_name = req.body.task_name;
  const task_description = req.body.task_description;
  const task_due_date = req.body.due_date;
  const task_owner_id = req.body.task_owner;
  const project_id = req.body.projectId;
  const status_id = req.body.status;

  User.findById(task_owner_id)
    .then((userData) => {
      if (!userData) {
        throw new Error("User not found");
      }

      const task = new Task({
        task_name: task_name,
        task_description: task_description,
        task_due_date: task_due_date,
        task_owner_id: task_owner_id,
        project_id: project_id,
        status_id: status_id
      });

      return task.save();
    })
    .then((result) => {
      console.log("Created Task");
      res.redirect(`/task-list/${project_id}`);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Internal Server Error");
    });
};

exports.postDeleteTask = (req, res, next) => {
  console.log("Task details for delete:", req.body);
  const project_id = req.body.projectId;

  if (req.session.user.role.role_name === 'User') {
    return res.status(403).send("Forbidden: Only admins and managers can delete projects.");
  }

  const taskId = req.body.taskId;
  Task.findByIdAndRemove(taskId)
  .then(() => {
    console.log("Destroyed Task");
    res.redirect(`/task-list/${project_id}`);
  })
  .catch((err) => console.log(err));
};

/*exports.getTaskList = (req, res, next) => {

  const projectId = req.params.projectId;
  res.render("admin/task-list", {
    pageTitle: 'Task List',
    path: 'admin/task-list',
    isAuthenticated: req.session.isLoggedIn,
    tasks: [],
    projectId
  })
}*/

exports.getTaskList = async (req, res, next) => {
  try {
    const user = req.session.user;
    const projectId = req.params.projectId;
    console.log("Logged in user:", user);
    console.log("Project ID:", projectId);

    if (!user) {
      return res.status(401).send("Unauthorized");
    }

    let tasks;

    if (user.role.role_name === "Admin") {
      // Admin can see all tasks (optionally filter by project)
      tasks = await Task.find(projectId ? { project_id: projectId } : {})
        .populate('task_owner_id', 'name email')
        .populate('project_id', 'project_name')
        .populate('status_id', 'status_name');
    } else if (user.role.role_name === "Manager") {
      // Get all project IDs owned by this manager
      const ownedProjects = await Project.find({ project_owner_id: user._id }, '_id');
      const ownedProjectIds = ownedProjects.map(p => p._id);

      const taskFilter = {
        project_id: { $in: ownedProjectIds }
      };

      // If a specific projectId is provided, further filter it
      if (projectId) {
        taskFilter.project_id = projectId;
      }

      tasks = await Task.find(taskFilter)
        .populate('task_owner_id', 'name email')
        .populate('project_id', 'project_name')
        .populate('status_id', 'status_name');
    } else if (user.role.role_name === "User") {
      // Users see only their tasks (optionally filtered by project)
      const taskFilter = { task_owner_id: user._id };

      if (projectId) {
        taskFilter.project_id = projectId;
      }
      // Fetch the tasks for the user
      tasks = await Task.find(taskFilter)
      .populate('task_owner_id', 'name email')
      .populate('project_id', 'project_name')
      .populate('status_id', 'status_name');
    }
    console.log("Task details:", tasks);

    res.render("task/task-list", {
      pageTitle: 'Task List',
      path: 'task/task-list',
      isAuthenticated: req.session.isLoggedIn,
      tasks,
      projectId,
      userRole: req.session.user.role.role_name,
      userName: req.session.user.name
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
};

exports.getEditTask = async (req, res, next) => {
  const editMode = req.query.edit;
  const project_id = req.body.projectId;
  if (!editMode) {
    return res.redirect('/task-list');
  }

  const taskId = req.params.taskId;
  try {
    const task = await Task.findById(taskId);
    if (!task) return res.redirect('/task-list');

    const users = await User.find({ 'role.role_name': 'User' }, 'name email');
    const statuses = await Status.find(); 

    res.render("task/task", {
      pageTitle: "Edit Task",
      path: "task/task",
      editing: editMode,
      task,
      task_owner: users,
      status: statuses,
      project_id: task.project_id, // needed for dynamic form action,
      task_id: taskId,
      isAuthenticated: req.session.isLoggedIn,
      userRole: req.session.user.role.role_name,
      userName: req.session.user.name
    });
  } catch (err) {
    console.error('Edit Task Error:', err);
    res.redirect(`/task-list/${project_id}`);
  }
};


exports.postEditTask = (req, res, next) => {
  console.log("Updated task details", req.body)
  const task_id = req.body.taskId;
  const task_name = req.body.task_name;
  const task_description = req.body.task_description;
  const task_due_date = req.body.due_date;
  const task_owner_id = req.body.task_owner;
  const status_id = req.body.status;
  const project_id = req.body.projectId;

  Task.findById(task_id)
  .then((task) => {
    task.task_name = task_name;
    task.task_description = task_description;
    task.task_due_date = task_due_date;
    task.task_owner_id = task_owner_id;
    task.project_id = project_id;
    task.status_id = status_id;
    return task.save();
  })
  .then((result) => {
    console.log("UPDATED Task!");
    res.redirect(`/task-list/${project_id}`);
  })
  .catch((err) => console.log(err));
};
