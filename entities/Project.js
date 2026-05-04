export default {
  list: (sort = '-created_date') => {
    return base44.entities.Project.list(sort);
  },
  get: (id) => {
    return base44.entities.Project.get(id);
  },
  create: (data) => {
    return base44.entities.Project.create(data);
  },
  update: (id, data) => {
    return base44.entities.Project.update(id, data);
  },
  delete: (id) => {
    return base44.entities.Project.delete(id);
  }
};