function sgdCredentialIsCurrent_(session, account) {
  if (Object.prototype.hasOwnProperty.call(session, 'credentialVersion')) {
    return session.credentialVersion === String(account.Password_Salt || '');
  }
  const date = account.Fecha_Cambio_Clave;
  const local = String(date || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  const lastChange = local ? Date.parse(local[3] + '-' + local[2] + '-' + local[1] + 'T' + local[4] + '-05:00') : parseFlexibleDateMs_(date);
  return !lastChange || parseFlexibleDateMs_(session.loginAt) >= lastChange;
}

function sgdOtherSessionKeys_(properties, session, now) {
  const keys = [];
  const prefix = SGD_SESSION_PROP_PREFIX;
  for (const [key, value] of Object.entries(properties.getProperties())) {
    if (!key.startsWith(prefix) || key === sessionPropKey_(session.token)) continue;
    try {
      const envelope = JSON.parse(value);
      if (!(Number(envelope.expiresAt) > now)) continue;
      const stored = JSON.parse(envelope.session);
      if (stored.userId === session.userId) keys.push(key);
    } catch (error) {
      // Las entradas que ya no contienen una sesión válida se eliminan en la limpieza habitual.
    }
  }
  return keys;
}

function getSgdSessionOverviewSGD(token) {
  const session = authSession_(token);
  const props = PropertiesService.getScriptProperties();
  return {loginAt: session.loginAt, others: sgdOtherSessionKeys_(props, session, Date.now()).length};
}

function closeOtherSgdSessionsSGD(token) {
  return fdLocked_(() => {
    const session = authSession_(token);
    const props = PropertiesService.getScriptProperties();
    const keys = sgdOtherSessionKeys_(props, session, Date.now());
    const cache = CacheService.getScriptCache();
    for (const key of keys) {
      props.deleteProperty(key);
      cache.remove('sess:' + key.slice(SGD_SESSION_PROP_PREFIX.length));
    }
    if (keys.length) audit_(session, 'LOGOUT_OTRAS_SESIONES', 'USUARIO', session.userId, String(keys.length));
    return {closed: keys.length, loginAt: session.loginAt, others: 0};
  });
}
