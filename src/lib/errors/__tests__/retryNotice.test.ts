/**
 * w4-p04 — the notice of an incomplete write offers a retry when there is
 * something to retry, and says only the text when there is not.
 */
import { noticeWithRetry } from "src/lib/errors/retryNotice";

describe("noticeWithRetry", () => {
  it("without a retry it is a plain notice", () => {
    const notice = noticeWithRetry("Not saved", undefined) as unknown as { message: unknown };
    expect(notice.message).toBe("Not saved");
  });

  it("with a retry it carries a button that closes the notice and retries", () => {
    const retry = jest.fn();
    const notice = noticeWithRetry("Not saved", retry) as unknown as {
      message: DocumentFragment;
      hide: jest.Mock;
    };
    const holder = document.createElement("div");
    holder.append(notice.message);
    expect(holder.textContent).toContain("Not saved");
    const button = holder.querySelector("button");
    expect(button).not.toBeNull();
    button!.click();
    expect(notice.hide).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
