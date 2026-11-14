import { Icon } from "../brand";
export function DocumentPreview() {
  return (
    <div className="document-preview" aria-hidden="true">
      <div>
        <Icon name="document" />
        <span>Patient-shared wellbeing report</span>
      </div>
      <h3>
        A clearer thread
        <br />
        through the record.
      </h3>
      <span className="preview-rule" />
      <p>
        Confirmed experiences. Recorded activities.
        <br />
        Context and sources, kept together.
      </p>
      <div className="document-lines">
        <i />
        <i />
        <i />
      </div>
      <span>Descriptive records · No diagnosis</span>
    </div>
  );
}
