module.exports = {
  *cjs(task) {
    yield task.source('src/api.json').target('lib');
    yield task
      .source('src/*.js')
      .babel()
      .target('lib');
  },
};
