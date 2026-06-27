const api = () => window.electronAPI;
export const agentApi = {
  list()        { return api().agentDbList(); },
  get(id)       { return api().agentDbGet(id); },
  create(data)  { return api().agentDbCreate(data); },
  update(id, d) { return api().agentDbUpdate(id, d); },
  delete(id)    { return api().agentDbDelete(id); },
  listByType(t) { return api().agentDbListByType(t); },
  saveAvatar({ base64, filename }) {
    return api().saveAvatar({ base64, filename });
  },
  openDirectoryDialog(options) {
    return api().showOpenDialog(options);
  },
};
