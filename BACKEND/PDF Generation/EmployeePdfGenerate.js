import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import jsdom from "jsdom";
import registerUsers from "../Schema/register.js";
import moment from "moment/moment.js";
import Order from "../Schema/Order.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const EmployeePdfGenerator = async (req, res) => {
  try {
    const { empId } = req.query;
    const employeeData = await registerUsers.findOne({
      empId,
      role: "employee",
    });
    const orderData = await Order.find({
      cartId: employeeData?.cartId,
    });
    const allProducts = orderData.reduce((result, current) => {
      let createdAt = current.createdAt;
      let orderId = current.orderId;
      current.products.forEach((product) => {
        result.push({ product, createdAt: createdAt, orderId });
      });
      return result;
    }, []);
    console.log(allProducts);

    function addCellHeader(text, x, y, width, height, align = "center") {
      doc.lineWidth(2); // Set the border line width
      doc.strokeColor("#2196f3"); // Set the border color to black
      doc.rect(x, y, width, height).stroke(); // Draw the cell border
      doc.fillColor("#673ab7"); // Set the text color to black
      doc.text(text, x, y + 3, { width, height, align }); // Add cell content
    }

    function addCell(text, x, y, width, height, align = "center") {
      doc.lineWidth(2); // Set the border line width
      doc.strokeColor("#2196f3"); // Set the border color to black
      doc.rect(x, y, width, height).stroke(); // Draw the cell border
      doc.fillColor("black"); // Set the text color to black
      doc.text(text, x, y + 3, { width, height, align }); // Add cell content
    }
    // Create a function to split an array into chunks
    function chunkArray(array, chunkSize) {
      const chunks = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    }

    // Set a maximum of 15 rows per page
    const maxRowsPerPage = 15;
    const tableDataChunks = chunkArray(allProducts, maxRowsPerPage);

    const basePath = path.join(__dirname, "..");

    // Initialize the PDF document
    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="testing.pdf"`);

    // Set precise margins for the entire page
    const margin = 30;
    doc.page.margins = {
      top: margin,
      bottom: margin,
      left: margin,
      right: margin,
    };
    doc.on("pageAdded", () => {
      // Set precise margins for the entire page
      doc.page.margins = {
        top: margin,
        bottom: margin,
        left: margin,
        right: margin,
      };
    });

    // Calculate the width of the PDF page
    const MAX_PAGE_HEIGHT =
      doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

    function addLine(index) {
      doc
        .lineWidth(2)
        .strokeColor("#2196f3")
        .moveTo(
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom - 30
        )
        .lineTo(
          doc.page.width - doc.page.margins.right,
          doc.page.height - doc.page.margins.bottom - 30
        )
        .stroke();
      doc
        .fontSize(10)
        .text(
          `Page ${index}`,
          doc.page.width - 70,
          doc.page.height - doc.page.margins.bottom - 20
        );
    }

    function addEmpTable(tableData) {
      const tableX = margin;
      let tableY = doc.y + 10;
      const tableWidth = doc.page.width - margin * 2;
      const columnWidth = tableWidth / 3;
      const rowHeight = 30;

      // Add table headers
      doc
        .fontSize(14)
        .text("EMPLOYEE", tableX, tableY, {
          width: columnWidth,
        })
        .text("DEPARTMENT", tableX + columnWidth, tableY, {
          width: columnWidth,
        })
        .text("DATE", tableX + 2 * columnWidth, tableY, {
          width: columnWidth,
        });

      tableY += 20; // Adjust the row height as needed
      const formattedDate = moment(Date()).format("DD/MM/YYYY");
      doc.fillColor("black");
      doc
        .fontSize(16)
        .text(tableData[0], tableX, tableY, {
          width: columnWidth,
        })
        .text(tableData[1], tableX + columnWidth, tableY, {
          width: columnWidth,
        })
        .text(formattedDate, tableX + 2 * columnWidth, tableY, {
          width: columnWidth,
        });
    }

    // Function to add a cell with border

    // Add the table data
    function addTable(tableData) {
      const tableX = margin;
      let tableY = doc.y + 20;
      const tableWidth = doc.page.width - margin * 2;
      const columnWidth = tableWidth / 4;
      const rowHeight = 30;

      // Add table headers with borders
      doc.fontSize(14).font("Bree Serif").fillColor("#673ab7");

      addCellHeader("Order No.", tableX, tableY, columnWidth, rowHeight);
      addCellHeader(
        "Product Name",
        tableX + columnWidth,
        tableY,
        columnWidth,
        rowHeight
      );
      addCellHeader(
        "Quantity",
        tableX + 2 * columnWidth,
        tableY,
        columnWidth,
        rowHeight
      );
      addCellHeader(
        "Date",
        tableX + 3 * columnWidth,
        tableY,
        columnWidth,
        rowHeight
      );
      tableY += rowHeight; // Move down to the first row
      doc.fontSize(14).font("Bree Serif").fillColor("black");

      // Add table content (you can loop through your data to populate the table)
      tableData.forEach((row) => {
        // if (checkPageBreak(rowHeight, tableY)) {
        //   doc.addPage(); // Add a new page
        //   tableY = doc.page.margins.top + 20; // Reset the Y position for the first row on the new page
        // }
        console.log({ row });

        addCell(row.orderId, tableX, tableY, columnWidth, rowHeight);
        addCell(
          row.product.productName,
          tableX + columnWidth,
          tableY,
          columnWidth,
          rowHeight
        );
        addCell(
          row.product.updatedQuantity,
          tableX + 2 * columnWidth,
          tableY,
          columnWidth,
          rowHeight
        );
        addCell(
          row.createdAt,
          tableX + 3 * columnWidth,
          tableY,
          columnWidth,
          rowHeight
        );

        tableY += rowHeight; // Move to the next row
      });
    }

    doc.pipe(res);

    // Add package name with formatting and justification
    const logoPath = path.join(basePath, "PDF Generation/logo.png");
    const logoBuffer = fs.readFileSync(logoPath);

    const customFontPath = path.join(__dirname, "BreeSerif-Regular.ttf"); // Update the font path
    const customFont = "Bree Serif";

    doc.registerFont(customFont, customFontPath);
    doc.font("Bree Serif");
    doc.image(logoBuffer, 30, 29, { width: 100, height: 40 });

    // Add header divider line
    let dividerY = 90;
    doc
      .strokeColor("#2196f3")
      .lineWidth(2)
      .moveTo(doc.page.margins.left, dividerY)
      .lineTo(doc.page.width - doc.page.margins.right, dividerY)
      .stroke();

    // Add branch and order headings
    doc.fontSize(32).text("EMPLOYEE", doc.page.margins.left, doc.y + 20, {
      align: "left",
    });
    doc.fillColor("#673ab7");
    doc.fontSize(32).text("ORDER", doc.page.margins.left + 160, doc.y - 44, {
      align: "left",
    });
    doc.fillColor("#2196f3");
    doc.fontSize(32).text("REPORT", doc.page.margins.left + 270, doc.y - 44, {
      align: "left",
    });

    // Add employee table
    const tableEmpData = [employeeData.username, employeeData.dept];
    addEmpTable(tableEmpData);

    let pageNo = 0;
    if (tableDataChunks && tableDataChunks.length > 0) {
      for (let page = 0; page < tableDataChunks.length; page++) {
        const tableDataPage = tableDataChunks[page];
        if (page > 0) {
          doc.addPage();
        }

        addTable(tableDataPage);
        addLine(pageNo + 1);
        pageNo += 1;
      }
    } else {
      doc
        .fontSize(32)
        .fillColor("red")
        .text("No Order Found!!", doc.page.margins.left, doc.y + 70, {
          align: "center",
        });
      doc.fillColor("black");
      addLine(pageNo + 1);
    }

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Error generating PDF" });
  }
};
