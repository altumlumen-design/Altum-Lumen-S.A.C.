function sgdDestinationGroupContext_(token) {
  const session = auth_(token);
  if (!session.userId || !session.officeCode || norm_(session.role) === 'MAESTRO') {
    throw new Error('Esta opción requiere una cuenta de oficina.');
  }
  return {
    session,
    properties: PropertiesService.getScriptProperties(),
    key: 'SGD_DESTINOS:' + encodeURIComponent(session.officeCode) + ':' + encodeURIComponent(session.userId),
  };
}

function sgdReadDestinationGroups_(context) {
  return JSON.parse(context.properties.getProperty(context.key) || '[]');
}

function getDestinationGroupsSGD(token) {
  return sgdReadDestinationGroups_(sgdDestinationGroupContext_(token));
}

function sgdWriteDestinationGroups_(token, change) {
  const context = sgdDestinationGroupContext_(token);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Los grupos están ocupados. Vuelve a intentar.');
  try {
    const groups = sgdReadDestinationGroups_(context);
    change(context, groups);
    const json = JSON.stringify(groups);
    if (Utilities.newBlob(json).getBytes().length > 8000) throw new Error('El espacio para tus grupos está lleno.');
    if (groups.length) context.properties.setProperty(context.key, json);
    else context.properties.deleteProperty(context.key);
    return groups;
  } finally {
    lock.releaseLock();
  }
}

function saveDestinationGroupSGD(token, data) {
  const id = clean_(data?.id);
  const name = clean_(data?.name);
  const offices = Array.isArray(data?.offices) ? [...new Set(data.offices.map(code => clean_(code)).filter(Boolean))] : [];
  if (!name || name.length > 80 || !offices.length || offices.length > 15) {
    throw new Error('Indica un nombre de hasta 80 caracteres y selecciona entre 1 y 15 oficinas.');
  }
  return sgdWriteDestinationGroups_(token, (context, groups) => {
    const active = new Set(listOffices_().filter(o => norm_(o.Activa) === 'SI').map(o => String(o['Código'])));
    if (offices.some(code => code === context.session.officeCode || !active.has(code))) {
      throw new Error('Verifica que todas las oficinas estén activas y sean distintas de la tuya.');
    }
    const index = groups.findIndex(group => group.id === id);
    if (id && (index < 0 || groups[index].revision !== data.revision)) {
      throw new Error('Este grupo cambió en otro dispositivo. Vuelve a abrirlo.');
    }
    if (groups.some(group => group.id !== id && norm_(group.name) === norm_(name))) {
      throw new Error('Ya tienes un grupo con ese nombre.');
    }
    if (!id && groups.length >= 12) throw new Error('Puedes guardar hasta 12 grupos.');
    const group = {id: id || Utilities.getUuid(), revision: Utilities.getUuid(), name, offices};
    if (id) groups[index] = group;
    else groups.push(group);
  });
}

function deleteDestinationGroupSGD(token, id, revision) {
  return sgdWriteDestinationGroups_(token, (_, groups) => {
    const index = groups.findIndex(group => group.id === id);
    if (index < 0 || groups[index].revision !== revision) {
      throw new Error('Este grupo cambió en otro dispositivo. Vuelve a abrirlo.');
    }
    groups.splice(index, 1);
  });
}
