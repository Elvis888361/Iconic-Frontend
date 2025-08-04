import { environment } from "../../environments/environment"
import {
  Component,
  Input,
  ViewChild,
  type ElementRef,
  type OnInit,
  type OnDestroy,
  type AfterViewInit,
 ChangeDetectorRef,
} from "@angular/core"
import { HttpClient, HttpHeaders } from "@angular/common/http"
import { WebsocketService } from "../services/websocket.service"

@Component({
  selector: "app-inbox",
  templateUrl: "inbox.page.html",
  styleUrls: ["inbox.page.scss"],
})
export class InboxPage {

}