/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2017, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/

import {
  ReadonlyJSONObject
} from '@phosphor/coreutils';

import {
  DataModel
} from './datamodel';

/**
 * A View implementation for in-memory JSON data.
 */
export
class View {
  /**
   * Create a view with static JSON data.
   *
   * @param options - The options for initializing the view.
   */
  constructor(options: View.IOptions) {
    let split = Private.splitFields(options.schema);
    this._data = options.data;
    this._bodyFields = split.bodyFields;
    this._headerFields = split.headerFields;
    this._missingValues = Private.createMissingMap(options.schema);
  }

  /**
   * Get the row count for a region in the view.
   *
   * @param region - The row region of interest.
   *
   * @returns - The row count for the region.
   */
  rowCount(region: DataModel.RowRegion): number {
    if (region === 'body') {
      return this._data.length;
    }
    return 1;
  }

  /**
   * Get the column count for a region in the view.
   *
   * @param region - The column region of interest.
   *
   * @returns - The column count for the region.
   */
  columnCount(region: DataModel.ColumnRegion): number {
    if (region === 'body') {
      return this._bodyFields.length;
    }
    return this._headerFields.length;
  }

  /**
   * Get the metadata for a column in the view.
   *
   * @param region - The cell region of interest.
   *
   * @param column - The index of the column of interest.
   *
   * @returns The metadata for the column.
   */
  metadata(region: DataModel.CellRegion, column: number): DataModel.Metadata {
    if (region === 'body' || region === 'column-header') {
      return this._bodyFields[column];
    }
    return this._headerFields[column];
  }

  /**
   * Get the data value for a cell in the view.
   *
   * @param region - The cell region of interest.
   *
   * @param row - The row index of the cell of interest.
   *
   * @param column - The column index of the cell of interest.
   *
   * @param returns - The data value for the specified cell.
   *
   * #### Notes
   * A `missingValue` as defined by the schema is converted to `null`.
   */
  data(region: DataModel.CellRegion, row: number, column: number): any {
    // Set up the field and value variables.

    let field: View.IField;
    let value: any;

    // Look up the field and value for the region.
    switch (region) {
      case 'body':
        field = this._bodyFields[column];
        value = this._data[row][field.name];
        break;
      case 'column-header':
        field = this._bodyFields[column];
        value = field.name;
        break;
      case 'row-header':
        field = this._headerFields[column];
        value = this._data[row][field.name];
        break;
      case 'corner-header':
        field = this._headerFields[column];
        value = field.name;
        break;
      default:
        throw 'unreachable';
    }

    // Test whether the value is a missing value.
    let missing = (
      this._missingValues !== null &&
      typeof value === 'string' &&
      this._missingValues[value] === true
    );

    // Return the final value.
    return missing ? null : value;
  }
  private _data: View.DataSource;
  private _bodyFields: View.IField[];
  private _headerFields: View.IField[];
  private _missingValues: Private.MissingValuesMap | null;
}


/**
 * The namespace for the `View` class statics.
 */
export
namespace View {
  /**
   * An object which describes a column of data in the view.
   *
   * #### Notes
   * This is based on the JSON Table Schema specification:
   * https://specs.frictionlessdata.io/table-schema/
   */
  export
  interface IField {
    /**
     * The name of the column.
     *
     * This is used as the key to extract a value from a data record.
     * It is also used as the column header label.
     */
    readonly name: string;

    /**
     * The type of data held in the column.
     */
    readonly type: string;
  }

  /**
   * An object when specifies the schema for a view.
   *
   * #### Notes
   * This is based on the JSON Table Schema specification:
   * https://specs.frictionlessdata.io/table-schema/
   */
  export
  interface ISchema {
    /**
     * The fields which describe the view columns.
     *
     * Primary key fields are rendered as row header columns.
     */
    readonly fields: IField[];

    /**
     * The values to treat as "missing" data.
     *
     * Missing values are automatically converted to `null`.
     */
    readonly missingValues?: string[];

    /**
     * The field names which act as primary keys.
     *
     * Primary key fields are rendered as row header columns.
     */
    readonly primaryKey?: string | string[];
  }

  /**
   * A type alias for a data source for a JSON data model.
   *
   * A data source is an array of JSON object records which represent
   * the rows of the table. The keys of the records correspond to the
   * field names of the columns.
   */
  export
  type DataSource = ReadonlyArray<ReadonlyJSONObject>;

  /**
   * An options object for initializing a view.
   */
  export
  interface IOptions {
    /**
     * The schema for the for the view.
     *
     * The schema should be treated as an immutable object.
     */
    schema: ISchema;

    /**
     * The data source for the view.
     *
     * The data model takes full ownership of the data source.
     */
    data: DataSource;
  }
}

/**
 * The namespace for the module implementation details.
 */
namespace Private {
  /**
   * An object which holds the results of splitting schema fields.
   */
  export
  interface ISplitFieldsResult {
    /**
     * The non-primary key fields to use for the grid body.
     */
    bodyFields: View.IField[];

    /**
     * The primary key fields to use for the grid headers.
     */
    headerFields: View.IField[];
  }

  /**
   * Split the schema fields into header and body fields.
   */
  export
  function splitFields(schema: View.ISchema): ISplitFieldsResult {
    // Normalize the primary keys.
    let primaryKeys: string[];
    if (schema.primaryKey === undefined) {
      primaryKeys = [];
    } else if (typeof schema.primaryKey === 'string') {
      primaryKeys = [schema.primaryKey];
    } else {
      primaryKeys = schema.primaryKey;
    }

    // Separate the fields for the body and header.
    let bodyFields: View.IField[] = [];
    let headerFields: View.IField[] = [];
    for (let field of schema.fields) {
      if (primaryKeys.indexOf(field.name) === -1) {
        bodyFields.push(field);
      } else {
        headerFields.push(field);
      }
    }

    // Return the separated fields.
    return { bodyFields, headerFields };
  }

  /**
   * A type alias for a missing value map.
   */
  export
  type MissingValuesMap = { [key: string]: boolean };

  /**
   * Create a missing values map for a schema.
   *
   * This returns `null` if there are no missing values.
   */
  export
  function createMissingMap(schema: View.ISchema): MissingValuesMap | null {
    // Bail early if there are no missing values.
    if (!schema.missingValues || schema.missingValues.length === 0) {
      return null;
    }

    // Collect the missing values into a map.
    let result: MissingValuesMap = Object.create(null);
    for (let value of schema.missingValues) {
      result[value] = true;
    }

    // Return the populated map.
    return result;
  }
}
