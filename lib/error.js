/**
 * Error normalization.
 **/

module.exports = (debug, container) => {

  const CONTAINER_ID      = container.long,
       CONTAINER_SHORT_ID = container.short;

  debug('using error normalization as res#error')
  return (req, res, done) => {
    /**
     * Return an error based on severity.
     *
     * @param {String} data - error to include
     * @param {Boolean} severe - true if severe error, undefined/false when not
     * @returns {Express#Send} res.send response
     **/
    res.error = (data, severe) => {
      let template = null;

      if(severe) {
        template = [
          '<h1>An Error has occurred.</h1>',
          '<br />',
          '<p>',
          'We\'re deeply sorry about this, please forward this',
          '<br />',
          'information to ',
          '<a href=\'mailto:jaredallard@outlook.com\'>jaredallard@outlook.com</a> ',
          'in order',
          '<br />',
          'to have this issue be resolved quickly.',
          '</p>',
          '<br /><br />',
          '<b>Error</b>:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;',
          data,
          '<br />',
          '<b>Container</b>: ',
          CONTAINER_SHORT_ID
        ];
      } else {
        template = [
          '<b>',
          data,
          '</b>',
          '<br /><br />',
          'CID: ',
          CONTAINER_SHORT_ID
        ];
      }

      res.send(template.join(''));
    };

    return done();
  };
}
